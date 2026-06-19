import uuid
import networkx as nx
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

class Node(BaseModel):
    id: str
    node_type: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class Edge(BaseModel):
    id: str
    source: str
    target: str
    edge_type: str
    properties: Dict[str, Any] = Field(default_factory=dict)

class Divergence(BaseModel):
    id: str
    claim_a_id: str
    claim_b_id: str
    topic: str
    status: str = "active" # active, resolved

class TemporalGraph:
    """
    The case graph. Nodes are clinical events, entities, and facts.
    Edges are temporal, causal, and associative links.
    """
    def __init__(self):
        self._graph = nx.MultiDiGraph()
        self._divergences: Dict[str, Divergence] = {}

    def add_node(self, node_type: str, properties: Dict[str, Any] = None) -> str:
        node_id = str(uuid.uuid4())
        props = properties or {}
        node = Node(id=node_id, node_type=node_type, properties=props)
        self._graph.add_node(node_id, data=node)
        return node_id

    def get_node(self, node_id: str) -> Optional[Node]:
        if self._graph.has_node(node_id):
            return self._graph.nodes[node_id]['data']
        return None

    def add_edge(self, source: str, target: str, edge_type: str, properties: Dict[str, Any] = None) -> str:
        edge_id = str(uuid.uuid4())
        props = properties or {}
        edge = Edge(id=edge_id, source=source, target=target, edge_type=edge_type, properties=props)
        self._graph.add_edge(source, target, key=edge_id, data=edge)
        return edge_id

    def get_edge(self, edge_id: str) -> Optional[Edge]:
        for u, v, k, d in self._graph.edges(keys=True, data=True):
            if k == edge_id:
                return d['data']
        return None

    def add_divergence(self, claim_a_id: str, claim_b_id: str, topic: str) -> str:
        """
        Registers a divergence between two claims.
        Crucially, this does NOT overwrite either claim. It holds both and creates a contradiction edge.
        """
        div_id = str(uuid.uuid4())
        divergence = Divergence(
            id=div_id,
            claim_a_id=claim_a_id,
            claim_b_id=claim_b_id,
            topic=topic,
            status="active"
        )
        self._divergences[div_id] = divergence
        
        # Add a contradiction edge between the two nodes
        self.add_edge(claim_a_id, claim_b_id, "contradicts", {"divergence_id": div_id})
        self.add_edge(claim_b_id, claim_a_id, "contradicts", {"divergence_id": div_id})
        
        return div_id

    def get_divergence(self, div_id: str) -> Optional[Divergence]:
        return self._divergences.get(div_id)

    def get_all_divergences(self) -> List[Divergence]:
        return list(self._divergences.values())

    def get_all_nodes(self) -> List[Node]:
        """Returns all nodes in the memory substrate."""
        return [data['data'] for _, data in self._graph.nodes(data=True)]
