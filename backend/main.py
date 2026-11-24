
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Literal

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, DateTime, select
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session

from algorithms import (
    smart_schedule,
    ActivityLinkedList,
    TaskBST,
)


# =========================================
# DATABASE
# =========================================

DATABASE_URL = "sqlite:///./flowmind.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    department = Column(String(100), nullable=False)
    assignee = Column(String(100), default="Unassigned")
    priority = Column(String(20), default="Medium")
    status = Column(String(20), default="Pending")
    due = Column(String(100), default="Not set")
    created_at = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )


# =========================================
# SCHEMAS
# =========================================

class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    department: str = "Sales"
    assignee: str = "Unassigned"
    priority: Literal["High", "Medium", "Low"] = "Medium"
    due: str = "Not set"


class TaskResponse(TaskCreate):
    id: int
    status: Literal["Pending", "In Progress", "Completed"]

    model_config = {"from_attributes": True}


class TaskStatusUpdate(BaseModel):
    status: Literal["Pending", "In Progress", "Completed"]


class DependencyInput(BaseModel):
    before: int
    after: int


class ScheduleRequest(BaseModel):
    dependencies: list[DependencyInput] = Field(
        default_factory=list
    )


# =========================================
# DSA DATA STRUCTURES
# =========================================

activity_history = ActivityLinkedList()


def record_activity(action: str, task_id: int, title: str):
    activity_history.append({
        "action": action,
        "task_id": task_id,
        "title": title,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


def task_to_dict(task: Task) -> dict:
    return {
        "id": task.id,
        "title": task.title,
        "department": task.department,
        "assignee": task.assignee,
        "priority": task.priority,
        "status": task.status,
        "due": task.due,
    }


def build_task_bst(db: Session) -> TaskBST:
    tree = TaskBST()

    tasks = db.execute(select(Task)).scalars().all()

    for task in tasks:
        tree.insert(task_to_dict(task))

    return tree


# =========================================
# APP SETUP
# =========================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="FlowMind API",
    description="Smart Workflow & Task Optimization System",
    version="1.1.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()


# =========================================
# BASIC ROUTES
# =========================================

@app.get("/")
def home():
    return {
        "message": "FlowMind Backend is Running!",
        "status": "success"
    }


@app.get("/health")
def health():
    return {"status": "healthy"}


# =========================================
# TASK ROUTES
# =========================================

@app.get("/tasks", response_model=list[TaskResponse])
def get_tasks(db: Session = Depends(get_db)):
    return db.query(Task).order_by(Task.id.desc()).all()


@app.post("/tasks", response_model=TaskResponse, status_code=201)
def create_task(data: TaskCreate, db: Session = Depends(get_db)):
    if not data.title.strip():
        raise HTTPException(
            status_code=422,
            detail="Task title cannot be empty"
        )

    values = data.model_dump()
    values["title"] = data.title.strip()

    task = Task(**values)

    db.add(task)
    db.commit()
    db.refresh(task)

    record_activity("Created", task.id, task.title)

    return task


@app.patch("/tasks/{task_id}/status", response_model=TaskResponse)
def update_task_status(
    task_id: int,
    data: TaskStatusUpdate,
    db: Session = Depends(get_db)
):
    task = db.get(Task, task_id)

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    task.status = data.status
    db.commit()
    db.refresh(task)

    record_activity(
        f"Status changed to {data.status}",
        task.id,
        task.title
    )

    return task


@app.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.get(Task, task_id)

    if task is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found"
        )

    title = task.title

    db.delete(task)
    db.commit()

    record_activity("Deleted", task_id, title)

    return {"message": "Task deleted successfully"}


# =========================================
# SMART SCHEDULING
# =========================================

@app.post("/smart-schedule")
def generate_smart_schedule(
    request: ScheduleRequest,
    db: Session = Depends(get_db)
):
    database_tasks = db.execute(
        select(Task).where(Task.status != "Completed")
    ).scalars().all()

    tasks = [
        {
            "id": task.id,
            "title": task.title,
            "priority": task.priority,
            "department": task.department,
        }
        for task in database_tasks
    ]

    dependencies = [
        dependency.model_dump()
        for dependency in request.dependencies
    ]

    try:
        return smart_schedule(tasks, dependencies)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error)
        )


# =========================================
# LINKED LIST API
# =========================================

@app.get("/activity-history")
def get_activity_history():
    return {
        "data_structure": "Custom Singly Linked List",
        "total_activities": len(activity_history),
        "activities": activity_history.to_list()
    }


# =========================================
# BINARY SEARCH TREE API
# =========================================

@app.get("/bst/search/{task_id}")
def search_task_with_bst(
    task_id: int,
    db: Session = Depends(get_db)
):
    tree = build_task_bst(db)
    result = tree.search(task_id)

    if result is None:
        raise HTTPException(
            status_code=404,
            detail="Task not found in BST"
        )

    return {
        "data_structure": "Binary Search Tree",
        "search_key": task_id,
        "found": True,
        "task": result
    }


@app.get("/bst/inorder")
def get_bst_inorder(db: Session = Depends(get_db)):
    tree = build_task_bst(db)
    tasks = tree.inorder()

    return {
        "data_structure": "Binary Search Tree",
        "traversal": "Inorder",
        "total_tasks": len(tasks),
        "tasks": tasks
    }
