from crux.causation.chain_builder import CausationChain, CausalLink
from crux.causation.chain_attacker import ChainAttacker

def test_causation_engine():
    # 1. Feed a 4-link causation chain
    chain = CausationChain(links=[
        CausalLink(id="L1", description="Radiologist found 2.1 cm mass", credibility=0.95),
        CausalLink(id="L2", description="PCP wrote 'unremarkable'", credibility=0.95),
        CausalLink(id="L3", description="22-month delay caused progression to Stage IV", credibility=0.90),
        CausalLink(id="L4", description="Earlier detection = survival", credibility=0.85)
    ])
    
    # 2. Run chain attacker
    attacker = ChainAttacker()
    vulnerability_map = attacker.attack_chain(chain)
    
    # 3. Assert alternative causation and pre-existing condition attacks are generated
    assert vulnerability_map is not None
    assert "attacks" in vulnerability_map
    
    attacks = [attack["type"] for attack in vulnerability_map["attacks"]]
    assert "alternative_causation" in attacks
    assert "preexisting_condition" in attacks
    
    # 4. Assert vulnerability map specifies weakest link and defense flip
    assert vulnerability_map["weakest_link_id"] == "L3"
    assert "defense_flip" in vulnerability_map
    assert "tumor biology" in vulnerability_map["defense_flip"].lower()
