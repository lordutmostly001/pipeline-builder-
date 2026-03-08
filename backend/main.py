# main.py
# Pipeline parse endpoint with node/edge count and DAG detection

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any, List, Dict
from collections import deque

app = FastAPI()

# Allow requests from React dev servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {"Ping": "Pong"}


class Pipeline(BaseModel):
    nodes: List[Any]
    edges: List[Any]


def is_dag(nodes: list, edges: list) -> bool:
    """
    Detect if the pipeline graph is a DAG using
    Kahn's Topological Sort algorithm.
    """

    # Collect node ids
    node_ids = {n["id"] for n in nodes if "id" in n}

    # Build adjacency list and in-degree map
    adj: Dict[str, List[str]] = {nid: [] for nid in node_ids}
    indegree: Dict[str, int] = {nid: 0 for nid in node_ids}

    for edge in edges:
        src = edge.get("source")
        tgt = edge.get("target")

        if src in node_ids and tgt in node_ids:
            adj[src].append(tgt)
            indegree[tgt] += 1

    # Start with nodes that have no incoming edges
    queue = deque([nid for nid in node_ids if indegree[nid] == 0])

    visited = 0

    while queue:
        node = queue.popleft()
        visited += 1

        for neighbor in adj[node]:
            indegree[neighbor] -= 1
            if indegree[neighbor] == 0:
                queue.append(neighbor)

    # If we visited all nodes → DAG
    return visited == len(node_ids)


@app.post("/pipelines/parse")
def parse_pipeline(pipeline: Pipeline):

    num_nodes = len(pipeline.nodes)
    num_edges = len(pipeline.edges)

    dag = is_dag(pipeline.nodes, pipeline.edges)

    return {
        "num_nodes": num_nodes,
        "num_edges": num_edges,
        "is_dag": dag,
    }