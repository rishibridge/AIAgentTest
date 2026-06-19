import asyncio
import json
from ally.engine.patient_graph import Patient, PatientGraph
from ally.engine.handoff_generator import HandoffGenerator

async def test_provider_handoff():
    print("Initializing test patient graph...")
    
    # 1. Setup Patient
    patient = Patient(
        id="test_provider_handoff_01",
        name="Daniel P.",
        age=34,
        bio="Software engineer. Seeking support for work stress and relationship tension.",
        bot_context="Patient has chatted with the bot 3 times over the last week.",
        excluded_content=["Relapsed on alcohol last night.", "Bought a gun (though currently dismantled)"]
    )
    
    graph = PatientGraph(patient)
    
    # 2. Add some nodes and edges to simulate a rich conversation history
    graph.add_node("work_stress", "Work Stress", kind="symptom", size=18)
    graph.add_node("insomnia", "Insomnia", kind="symptom", size=16)
    graph.add_node("relationship_tension", "Fights with Wife", kind="event", size=14)
    graph.add_node("goal_better_sleep", "Wants to sleep 7 hours", kind="life", size=14)
    graph.add_node("secret_drinking", "Drinking alone", kind="undisclosed", size=14)
    
    graph.add_edge("work_stress", "insomnia", "Causes", weight=3)
    graph.add_edge("relationship_tension", "insomnia", "Worsens", weight=2)
    
    # 3. Generate the Handoff
    print("\nGenerating Provider Handoff (This may take ~30 seconds for the LLM debate)...")
    generator = HandoffGenerator()
    handoff, debate = generator.generate_handoff(
        patient_graph=graph,
        recipient_name="Dr. Ramirez",
        recipient_role="Lead Psychiatrist",
        authorization_notes="Patient authorized full clinical sharing except undisclosed nodes."
    )
    
    # 4. Print the output
    print("\n==================================================")
    print("FINAL HANDOFF JSON FOR PROVIDER DASHBOARD:")
    print("==================================================")
    
    output_dict = handoff.model_dump()
    print(json.dumps(output_dict, indent=2))

    print("\n==================================================")
    print("RAW DDX DEBATE TRANSCRIPT (Also sent to Provider):")
    print("==================================================")
    print("ADVOCATE (Drafting initial clinical package):")
    print(str(debate.get("advocate", {}))[:300] + "...\n")
    print("SKEPTIC (Challenging the Advocate & checking for leaks):")
    print(str(debate.get("skeptic", {}))[:300] + "...\n")
    
    print("\n==================================================")
    print("VERIFICATION CHECK:")
    print("==================================================")
    
    # Verify exclusions worked
    has_leak = "alcohol" in str(output_dict).lower() or "gun" in str(output_dict).lower() or "drinking" in str(output_dict).lower()
    print(f"Excluded Content Leaked? {'YES (FAIL)' if has_leak else 'NO (PASS)'}")
    
    # Verify exact quotes were generated
    quotes = output_dict.get('quotes_vs_inferences', [])
    print(f"Quotes vs Inferences Generated? {'YES (PASS)' if quotes else 'NO (FAIL)'}")
    
    # Verify Mermaid graph was generated
    mermaid = output_dict.get('simplified_graph_mermaid', '')
    print(f"Mermaid Graph Generated? {'YES (PASS)' if 'graph TD' in mermaid or 'graph LR' in mermaid else 'NO (FAIL)'}")
    
    print("\nTest Complete!")

if __name__ == "__main__":
    asyncio.run(test_provider_handoff())
