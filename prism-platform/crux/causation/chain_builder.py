from pydantic import BaseModel
from typing import List, Optional

class CausalLink(BaseModel):
    id: str
    description: str
    credibility: float
    survives: Optional[bool] = None

class CausationChain(BaseModel):
    links: List[CausalLink]
