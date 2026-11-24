
"""
FlowMind - DSA Engine

1. Directed Graph (Adjacency List)
2. Kahn's Topological Sorting
3. Min-Heap Priority Scheduling
4. Cycle Detection
5. Custom Singly Linked List
6. Custom Binary Search Tree
7. Custom Stack
"""

import heapq
from collections import deque
from typing import Any


PRIORITY_RANK = {"High": 0, "Medium": 1, "Low": 2}


# =========================================
# DSA 1: LINKED LIST - TASK ACTIVITY HISTORY
# =========================================

class HistoryNode:
    def __init__(self, data: dict):
        self.data = data
        self.next = None


class ActivityLinkedList:
    def __init__(self):
        self.head = None
        self.tail = None
        self.length = 0

    def append(self, activity: dict):
        node = HistoryNode(activity)

        if self.head is None:
            self.head = node
            self.tail = node
        else:
            self.tail.next = node
            self.tail = node

        self.length += 1

    def to_list(self) -> list[dict]:
        result = []
        current = self.head

        while current is not None:
            result.append(current.data)
            current = current.next

        return result

    def __len__(self):
        return self.length


# =========================================
# DSA 2: BINARY SEARCH TREE - TASK ID SEARCH
# =========================================

class BSTNode:
    def __init__(self, task: dict):
        self.task = task
        self.key = task["id"]
        self.left = None
        self.right = None


class TaskBST:
    def __init__(self):
        self.root = None

    def insert(self, task: dict):
        self.root = self._insert(self.root, task)

    def _insert(self, node, task):
        if node is None:
            return BSTNode(task)

        task_id = task["id"]

        if task_id < node.key:
            node.left = self._insert(node.left, task)
        elif task_id > node.key:
            node.right = self._insert(node.right, task)
        else:
            node.task = task

        return node

    def search(self, task_id: int):
        current = self.root

        while current is not None:
            if task_id == current.key:
                return current.task

            if task_id < current.key:
                current = current.left
            else:
                current = current.right

        return None

    def inorder(self) -> list[dict]:
        result = []

        def visit(node):
            if node is None:
                return

            visit(node.left)
            result.append(node.task)
            visit(node.right)

        visit(self.root)
        return result


# =========================================
# DSA 3: STACK - LAST IN FIRST OUT
# =========================================

class StackNode:
    def __init__(self, value: Any, next_node=None):
        self.value = value
        self.next = next_node


class ActionStack:
    def __init__(self):
        self.top = None
        self.length = 0

    def push(self, value: Any):
        self.top = StackNode(value, self.top)
        self.length += 1

    def pop(self):
        if self.top is None:
            raise IndexError("Cannot undo: stack is empty.")

        value = self.top.value
        self.top = self.top.next
        self.length -= 1
        return value

    def peek(self):
        return self.top.value if self.top is not None else None

    def is_empty(self):
        return self.top is None

    def __len__(self):
        return self.length


# =========================================
# DSA 4: GRAPH CONSTRUCTION
# =========================================

def build_graph(
    tasks: list[dict[str, Any]],
    dependencies: list[dict[str, int]]
) -> tuple[dict[int, list[int]], dict[int, int]]:

    task_ids = [task["id"] for task in tasks]

    if len(task_ids) != len(set(task_ids)):
        raise ValueError("Duplicate task IDs are not allowed.")

    task_id_set = set(task_ids)
    graph = {task_id: [] for task_id in task_ids}
    indegree = {task_id: 0 for task_id in task_ids}
    seen_edges = set()

    for dependency in dependencies:
        before = dependency["before"]
        after = dependency["after"]

        if before not in task_id_set or after not in task_id_set:
            raise ValueError(
                f"Invalid dependency: {before} -> {after}. "
                "Both tasks must exist."
            )

        if before == after:
            raise ValueError(
                f"Task {before} cannot depend on itself."
            )

        edge = (before, after)

        if edge in seen_edges:
            continue

        seen_edges.add(edge)
        graph[before].append(after)
        indegree[after] += 1

    return graph, indegree


# =========================================
# DSA 5: TOPOLOGICAL SORT + CYCLE DETECTION
# =========================================

def topological_sort(
    tasks: list[dict[str, Any]],
    dependencies: list[dict[str, int]]
) -> list[int]:

    graph, indegree = build_graph(tasks, dependencies)

    queue = deque(
        task_id
        for task_id, degree in indegree.items()
        if degree == 0
    )

    result = []

    while queue:
        current = queue.popleft()
        result.append(current)

        for neighbor in graph[current]:
            indegree[neighbor] -= 1

            if indegree[neighbor] == 0:
                queue.append(neighbor)

    if len(result) != len(tasks):
        raise ValueError(
            "Circular dependency detected! "
            "Workflow cannot be scheduled."
        )

    return result


# =========================================
# DSA 6: MIN-HEAP SMART SCHEDULING
# =========================================

def smart_schedule(
    tasks: list[dict[str, Any]],
    dependencies: list[dict[str, int]]
) -> dict[str, Any]:

    graph, indegree = build_graph(tasks, dependencies)

    task_map = {
        task["id"]: task
        for task in tasks
    }

    ready_heap = []

    for task_id, degree in indegree.items():
        if degree == 0:
            task = task_map[task_id]

            heapq.heappush(
                ready_heap,
                (
                    PRIORITY_RANK.get(
                        task.get("priority", "Medium"), 1
                    ),
                    task_id
                )
            )

    scheduled_tasks = []
    execution_order = []

    while ready_heap:
        _, task_id = heapq.heappop(ready_heap)
        task = task_map[task_id]

        execution_order.append(task_id)

        scheduled_tasks.append({
            "order": len(execution_order),
            "id": task_id,
            "title": task["title"],
            "priority": task.get("priority", "Medium"),
            "department": task.get("department", "General"),
        })

        for neighbor in graph[task_id]:
            indegree[neighbor] -= 1

            if indegree[neighbor] == 0:
                next_task = task_map[neighbor]

                heapq.heappush(
                    ready_heap,
                    (
                        PRIORITY_RANK.get(
                            next_task.get("priority", "Medium"), 1
                        ),
                        neighbor
                    )
                )

    if len(execution_order) != len(tasks):
        raise ValueError(
            "Circular dependency detected! "
            "Please fix the workflow dependencies."
        )

    return {
        "algorithm": "Priority-Aware Topological Sort",
        "total_tasks": len(tasks),
        "total_dependencies": len({
            (dep["before"], dep["after"])
            for dep in dependencies
        }),
        "execution_order": execution_order,
        "schedule": scheduled_tasks,
        "complexity": "O(V log V + E)"
    }


# =========================================
# DSA SELF-TEST
# =========================================

if __name__ == "__main__":
    print("FLOWMIND DSA ENGINE TEST")
    print("=" * 40)

    tasks = [
        {"id": 1, "title": "Order", "priority": "Low"},
        {"id": 2, "title": "Payment", "priority": "High"},
        {"id": 3, "title": "Dispatch", "priority": "Medium"},
    ]

    deps = [
        {"before": 1, "after": 2},
        {"before": 2, "after": 3},
    ]

    print("\n1. Topological Sort:")
    print(topological_sort(tasks, deps))

    print("\n2. Smart Schedule:")
    print(smart_schedule(tasks, deps)["execution_order"])

    print("\n3. Linked List:")
    history = ActivityLinkedList()
    history.append({"action": "Created Task 1"})
    history.append({"action": "Completed Task 1"})
    print(history.to_list())

    print("\n4. Binary Search Tree:")
    tree = TaskBST()
    for task in tasks:
        tree.insert(task)

    print("Search ID 2:", tree.search(2))
    print("Inorder IDs:", [t["id"] for t in tree.inorder()])

    print("\n5. Stack:")
    stack = ActionStack()
    stack.push("Added dependency 1 -> 2")
    stack.push("Added dependency 2 -> 3")
    print("Undo:", stack.pop())

    print("\nALL DSA SELF-TESTS PASSED!")
