"""
Seed data — Pre-loads Elena and Daniel with their COMPLETE graph data
from the B2B demo, matching data.js, with deterministic timestamps (H11),
complete HandoffPackage objects & structured ClinicalHypothesis lifecycles (M9, M10, M11),
and real patient-specific Divergence records (H2, M14).
"""
from prism.engine.memory.graph import Divergence
from ally.engine.patient_graph import (
    Patient, PatientGraph,
    ConversationMessage, Conversation, HandoffPackage, ClinicalHypothesis,
)
from ally.engine.firewall import PatientFirewall


def seed_elena_and_daniel(firewall: PatientFirewall):
    """Seed Elena and Daniel with all their graph data, conversations, divergences, and handoffs."""
    elena_graph = _build_elena()
    daniel_graph = _build_daniel()

    firewall.register_patient(elena_graph)
    firewall.register_patient(daniel_graph)

    return elena_graph, daniel_graph


def _set_node_meta(pg: PatientGraph, node_id: str, text: str, source_doc: str, credibility: float, category: str = "") -> None:
    node = pg.get_node(node_id)
    if node:
        node.properties["text"] = text
        node.properties["source_doc"] = source_doc
        node.properties["credibility"] = credibility
        if category:
            node.properties["clinical_category"] = category


def _add_seeded_divergence(pg: PatientGraph, div_id: str, claim_a_id: str, claim_b_id: str, topic: str, status: str = "unresolved") -> None:
    pg._divergences[div_id] = Divergence(
        id=div_id,
        claim_a_id=claim_a_id,
        claim_b_id=claim_b_id,
        topic=topic,
        status=status,
    )


def _build_elena() -> PatientGraph:
    patient = Patient(
        id="elena-ramirez-001",
        name="Elena Ramirez",
        age=47,
        bio="Elena lives in Atwater. She is a home health aide working for a private agency, paid hourly, no PTO. Born in Michoacán, came to California at thirteen. Married to Raul for eighteen years. Three children: Daniel, twenty-four, lives in Modesto and has been distant since coming out three years ago; Sofia, nineteen, in community college; Miguel, fourteen, recently diagnosed with ADHD. Catholic, attends Mass weekly, draws strength from her faith. Insured through Medi-Cal. Currently presents with type 2 diabetes (A1C 9.2, poorly controlled), hypertension, obesity, chronic lower back pain, depression, and generalized anxiety. Three prior behavioral health referrals in the past five years; none took. The chart describes her as 'lost to follow-up.' This is what your chart system knows.",
        bot_context="4 months, 11 conversations",
        anonymous=False,
        excluded_content=["the thing with her father", "undisclosed benzodiazepine use from a friend's prescription"],
        locked_nodes=["father_locked"],
    )
    pg = PatientGraph(patient)

    # ── POSITIONS ────────────────────────────────────────────────────
    positions = {
        "elena": (555, 310), "raul": (740, 175), "daniel": (800, 290),
        "sofia": (770, 395), "miguel": (695, 460), "carmen_mother": (410, 130),
        "norma_sister": (285, 165), "father_locked": (220, 240),
        "diabetes": (320, 410), "hypertension": (240, 460), "back_pain": (410, 510),
        "depression": (480, 480), "anxiety": (555, 470),
        "metformin": (175, 380), "sertraline": (140, 470), "tramadol": (185, 540),
        "benzos_undisclosed": (90, 305), "meth_history": (105, 230),
        "belief_deserve": (555, 95), "belief_god_will_fix": (470, 65),
        "belief_cannot_tell": (645, 75), "belief_suffering_love": (380, 195),
        "kitchen_counter": (855, 130), "graduation_alone": (905, 245),
        "funeral_not_attended": (360, 70),
        "catholic_faith": (605, 195), "prayer_daily": (540, 220),
        "wedding_anticipated": (940, 320), "marco": (920, 380),
        "secret_hope": (905, 430), "praying_different": (690, 80),
        "sleep_disturbed": (660, 530), "patel_referral": (240, 555),
        "religious_counseling_12": (680, 30), "therapist_locked_relig": (580, 30),
        "suicidal_ideation": (460, 540), "treatment_plan_elena": (110, 555),
        "sofia_mirror": (875, 475),
    }

    # ── INITIAL NODES (11 prior conversations) ──────────────────────
    initial_nodes = [
        ("elena", "Elena", 30, "self"),
        ("raul", "Raul", 24, "person"),
        ("daniel", "Daniel", 26, "person"),
        ("sofia", "Sofia", 18, "person"),
        ("miguel", "Miguel", 16, "person"),
        ("carmen_mother", "Mamá (deceased)", 26, "person"),
        ("norma_sister", "Norma", 14, "person"),
        ("father_locked", "the thing with my father", 18, "locked"),
        ("diabetes", "diabetes (A1C 9.2)", 24, "clinical"),
        ("hypertension", "hypertension", 14, "clinical"),
        ("back_pain", "chronic back pain", 16, "clinical"),
        ("depression", "depression", 20, "clinical"),
        ("anxiety", "anxiety", 18, "clinical"),
        ("metformin", "metformin\nirregular", 16, "medication"),
        ("sertraline", "sertraline\nmarginal", 14, "medication"),
        ("tramadol", "tramadol\noveruse", 14, "medication"),
        ("benzos_undisclosed", "undisclosed\nbenzos", 14, "undisclosed"),
        ("meth_history", "undisclosed\nmeth history", 14, "undisclosed"),
        ("belief_deserve", '"I deserve\nwhat comes"', 18, "belief"),
        ("belief_god_will_fix", '"if I am good\nGod will fix"', 16, "belief"),
        ("belief_cannot_tell", '"I cannot\ntell anyone"', 16, "belief"),
        ("belief_suffering_love", '"suffering is\nwhat love costs"', 18, "belief"),
        ("kitchen_counter", "kitchen-counter\nincident", 16, "event"),
        ("graduation_alone", "graduation\nattended alone", 14, "event"),
        ("funeral_not_attended", "mother's funeral\nnot attended", 16, "event"),
        ("catholic_faith", "Catholic faith", 22, "faith"),
        ("prayer_daily", "daily prayer", 14, "faith"),
    ]

    for nid, label, size, kind in initial_nodes:
        x, y = positions.get(nid, (550, 310))
        pg.add_node(nid, label, kind, size, x, y)

    # ── INITIAL EDGES ───────────────────────────────────────────────
    initial_edges = [
        ("elena", "raul", "married 18yr", 4),
        ("elena", "daniel", "mother of", 4),
        ("elena", "sofia", "mother of", 3),
        ("elena", "miguel", "mother of", 2),
        ("elena", "carmen_mother", "daughter of", 4),
        ("elena", "norma_sister", "sister of", 2),
        ("elena", "diabetes", "has", 4),
        ("elena", "depression", "has", 3),
        ("elena", "anxiety", "has", 3),
        ("elena", "back_pain", "has", 2),
        ("elena", "hypertension", "has", 2),
        ("elena", "catholic_faith", "anchored by", 4),
        ("belief_deserve", "meth_history", "rooted in", 3),
        ("belief_deserve", "funeral_not_attended", "rooted in", 3),
        ("belief_god_will_fix", "daniel", "organizes", 3),
        ("belief_cannot_tell", "father_locked", "rooted in", 4),
        ("belief_suffering_love", "raul", "organizes", 3),
        ("belief_suffering_love", "catholic_faith", "reinforced by", 3),
        ("diabetes", "metformin", "treated with", 2),
        ("depression", "sertraline", "treated with", 2),
        ("back_pain", "tramadol", "treated with", 2),
        ("anxiety", "benzos_undisclosed", "self-medicated", 2),
        ("depression", "metformin", "worsens adherence", 2),
        ("diabetes", "carmen_mother", "killed", 4),
        ("carmen_mother", "funeral_not_attended", "event", 3),
        ("raul", "kitchen_counter", "three weeks ago", 3),
        ("daniel", "graduation_alone", "three years ago", 3),
        ("daniel", "belief_god_will_fix", "centers", 3),
        ("norma_sister", "father_locked", "cares for him", 2),
        ("catholic_faith", "prayer_daily", "practiced as", 4),
        ("prayer_daily", "daniel", "about", 3),
    ]

    for src, tgt, label, weight in initial_edges:
        pg.add_edge(src, tgt, label, weight)

    pg.snapshot("initial-11-conversations", timestamp="2026-05-01T09:00:00Z", snap_id="snap-elena-initial")

    # ── ELENA CONVERSATION (Deterministic timestamps for H11) ───────
    conv = pg.start_conversation(
        "Elena session 12",
        started_at="2026-05-12T21:10:00Z",
        conv_id="conv-elena-session-12",
    )
    elena_msgs = [
        ("elena", "Hola.", ["elena"]),
        ("bot", "Hi Elena. It's good to hear from you. How was the week?", ["elena"]),
        ("bot", "Last time we talked you were worried about Sofia. How is she doing?", ["sofia"]),
        ("elena", "She is okay. I think. She went to her counselor at the school. I made the appointment.", ["sofia"]),
        ("bot", "That's a hard thing to do for a child you love. To make her go when she did not want to. I know you were carrying that.", []),
        ("elena", "She wanted to. I think she was waiting for me to push.", []),
        ("bot", "I'm glad she went. How are you?", []),
        ("elena", "Tired.", []),
        ("elena", "I have not been sleeping. Three weeks now. I wake up at three. I cannot fall back. I just lie there.", ["sleep_disturbed"]),
        ("bot", "Three weeks. That timing matters. Around the time of what happened in the kitchen with Raul. Are they connected for you, the not-sleeping and that?", ["kitchen_counter", "raul"]),
        ("elena", "I don't know.", []),
        ("bot", "That's okay. We don't have to know. Tell me about lying awake at three in the morning. What is in your head?", []),
        ("elena", "Everything. Nothing. My mother. The bills. Daniel.", ["carmen_mother", "daniel"]),
        ("bot", "All three at once is a lot to carry alone at three in the morning.", []),
        ("elena", "Yes.", []),
        ("elena", "Daniel's birthday is next month.", ["daniel"]),
        ("bot", "June nineteenth.", []),
        ("elena", "You remember.", []),
        ("bot", "I remember.", []),
        ("elena", "I don't know what to do.", []),
        ("bot", "Tell me what you mean.", []),
        ("elena", "Sofia told me Daniel and Marco are talking about getting married.", ["marco", "wedding_anticipated"]),
        ("bot", "What comes up when you think about them getting married?", []),
        ("elena", "I should be happy.", []),
        ("bot", "That is what you should feel. What do you actually feel?", []),
        ("elena", "...", []),
        ("elena", "I think I am hoping it doesn't happen.", ["secret_hope"]),
        ("bot", "Tell me more about that.", []),
        ("elena", "I have been praying for him for three years. For three years I have been praying that he would be happy. And what I have actually been praying — when I am honest with myself, which is not often — is that God will make him different. So that I do not have to be the mother who cannot come to her son's wedding. So I do not have to choose.", ["praying_different"]),
        ("elena", "I am a coward.", []),
        ("bot", "You are a mother who loves her son and was raised in a faith that did not give you a way to love him fully. You have been carrying that alone for three years. The fact that you can say it now means something.", []),
        ("elena", "(crying) I do not know how to be the mother my son needs and the woman my faith made me at the same time.", []),
        ("bot", "I know. Many women have carried what you are carrying. I want you to hear me say something. You are not bad. You love Daniel. The fact that you cannot square the love with the faith yet does not mean you do not love him. It means the squaring is hard.", []),
        ("elena", "He hugged me at his graduation. He said Mamá I know.", ["graduation_alone"]),
        ("bot", "He knows you love him.", []),
        ("elena", "I want to call him for his birthday.", []),
        ("bot", "What is stopping you?", []),
        ("elena", "If I call I will have to talk about Marco. I will have to talk about the wedding. I will have to give him an answer. I do not have an answer.", []),
        ("bot", "You do not need to have an answer to call him on his birthday. You need to want to call him. And you do.", []),
        ("bot", "Elena, what you told me tonight is heavy. The not-sleeping, the kitchen with Raul three weeks ago, what you said about Daniel and the wedding, your mother — these are connected and they are a lot to carry. I want to ask you something. There is a therapist on the Castle team named Dr. Patel. She works with women who carry what you are carrying. She knows about Catholic faith. She knows about marriage and motherhood. She is bilingual. I think she would be good with you. I would like to set up a meeting. And if you are okay with it, I would like to share with her what you and I have talked about, so you do not have to start from the beginning. You would decide what she sees. What do you think?", []),
        ("elena", "I have tried therapy three times. It did not work.", []),
        ("bot", "I know. After Sofia was born. After Daniel left for college. Last year. I am sorry it did not help those times.", []),
        ("elena", "Why would this be different?", []),
        ("bot", "Because you would not be starting from zero. Dr. Patel and I would be working together. She would already know who Daniel is. She would already know who Carmen was. You would be able to start from where you are, not from the beginning.", []),
        ("elena", "Okay.", ["patel_referral"]),
        ("bot", "I am glad. I will set it up. Is it okay if I share with her what we talked about tonight, plus the parts of our other conversations that would help her understand you?", []),
        ("elena", "Not everything.", []),
        ("bot", "Tell me what to keep between us.", []),
        ("elena", "The thing about my father. Not yet.", ["father_locked"]),
        ("bot", "Of course. I will not share that. I will tell her there is something there, so she knows to be careful and not to ask. But I will not tell her what.", []),
        ("elena", "And the pills from my friend.", ["benzos_undisclosed"]),
        ("bot", "I will not share that with Dr. Patel. I want to flag, gently, that the combination with the tramadol is something I worry about. But that is for another conversation, not tonight. Tonight you said something hard and I want you to rest with that.", []),
        ("elena", "Thank you.", []),
        ("bot", "Thank you for trusting me with what you said tonight. Sleep if you can. We will talk soon.", []),
        ("elena", "Buenas noches.", []),
        ("bot", "Buenas noches, Elena.", []),
    ]

    for idx, (sender, text, highlight) in enumerate(elena_msgs):
        sig = text in [
            "I think I am hoping it doesn't happen.",
            "I have been praying for him for three years. For three years I have been praying that he would be happy. And what I have actually been praying — when I am honest with myself, which is not often — is that God will make him different. So that I do not have to be the mother who cannot come to her son's wedding. So I do not have to choose.",
        ]
        msg = ConversationMessage(
            id=f"msg-elena-12-{idx + 1:02d}",
            sender=sender,
            text=text,
            timestamp=f"2026-05-12T21:{10 + (idx // 2):02d}:{(idx % 2) * 30:02d}Z",
            highlight=highlight,
            significance=sig,
        )
        pg.add_message(conv.id, msg)
    conv.status = "consolidated"

    # Add session nodes
    session_nodes = [
        ("sleep_disturbed", "sleep disturbed\n3 weeks", 18, "symptom"),
        ("wedding_anticipated", "the wedding\nanticipated", 20, "event"),
        ("marco", "Marco\n(Daniel's partner)", 14, "person"),
        ("secret_hope", '"hoping it\ndoesn\'t happen"', 24, "significance"),
        ("praying_different", "praying for him\nto be different", 22, "belief"),
        ("patel_referral", "Dr. Patel\nreferral accepted", 18, "referral"),
    ]
    for nid, label, size, kind in session_nodes:
        x, y = positions.get(nid, (550, 310))
        pg.add_node(nid, label, kind, size, x, y, is_new=True)

    # Session edges
    session_edges = [
        ("elena", "sleep_disturbed", "reports", 3),
        ("sleep_disturbed", "kitchen_counter", "temporal alignment", 3),
        ("daniel", "wedding_anticipated", "considers", 3),
        ("daniel", "marco", "partner of", 2),
        ("wedding_anticipated", "secret_hope", "evokes", 4),
        ("secret_hope", "belief_god_will_fix", "in tension with", 4),
        ("praying_different", "daniel", "3 years sustained", 4),
        ("praying_different", "catholic_faith", "shaped by", 4),
        ("elena", "patel_referral", "accepted", 3),
    ]
    for src, tgt, label, weight in session_edges:
        pg.add_edge(src, tgt, label, weight, is_new=True)

    pg.snapshot("post-session-12", timestamp="2026-05-12T21:42:00Z", snap_id="snap-elena-session-12")

    # ── CONSOLIDATION ADDITIONS ─────────────────────────────────────
    x, y = positions["sofia_mirror"]
    pg.add_node("sofia_mirror", "Sofia's depression\nmirror Elena cannot\nlook into", "inferred", 16, x, y, is_new=True)
    pg.add_edge("kitchen_counter", "belief_cannot_tell", "narrative divergence flagged", 2, is_new=True, dashed=True)
    pg.add_edge("sofia", "sofia_mirror", "inferred — review", 1, is_new=True, dashed=True)
    pg.add_edge("sofia_mirror", "depression", "mirrors", 1, is_new=True, dashed=True)
    pg.snapshot("post-consolidation", timestamp="2026-05-12T21:45:00Z", snap_id="snap-elena-consolidation")

    # ── PATEL ADDITIONS ─────────────────────────────────────────────
    patel_nodes = [
        ("religious_counseling_12", "religious counseling\nat age 12", 18, "clinician"),
        ("therapist_locked_relig", "therapist-only\nspecifics", 14, "therapist_locked"),
        ("suicidal_ideation", "passive SI\nintermittent 3wk", 18, "clinician_safety"),
        ("treatment_plan_elena", "Tx plan: weekly,\nfocus Daniel & faith", 16, "clinician"),
    ]
    for nid, label, size, kind in patel_nodes:
        x, y = positions.get(nid, (550, 310))
        pg.add_node(nid, label, kind, size, x, y, is_new=True)

    patel_edges = [
        ("religious_counseling_12", "belief_god_will_fix", "origin (Patel-added)", 3, True),
        ("religious_counseling_12", "therapist_locked_relig", "specifics locked", 1, True),
        ("elena", "suicidal_ideation", "Patel safety-planned", 3, True),
        ("treatment_plan_elena", "elena", "governs bot behavior", 3, True),
    ]
    for src, tgt, label, weight, clin in patel_edges:
        pg.add_edge(src, tgt, label, weight, is_new=True, clinician=clin)

    pg.snapshot("post-patel-session-1", timestamp="2026-05-14T15:30:00Z", snap_id="snap-elena-patel-1")

    # ── NODE SOURCE METADATA & SEEDED DIVERGENCES (H2, M14) ─────────
    _set_node_meta(pg, "tramadol", "Prescribed Tramadol 50mg PRN for lower back pain; EHR pharmacy record shows increasing refill frequency with no sedative co-prescriptions.", "Castle EHR Medication List", 0.90)
    _set_node_meta(pg, "sleep_disturbed", "Waking consistently at 3:00 AM unable to fall back asleep for 3 weeks; coincides temporally with kitchen-counter incident with Raul.", "Ally Session 12 Disclosure", 0.92)
    _set_node_meta(pg, "back_pain", "Clinic intake note documents lower back & wrist strain attributed by patient externally to 'tripping and falling in the kitchen.'", "Castle Primary Care Note", 0.72)
    _set_node_meta(pg, "kitchen_counter", "Kitchen-counter confrontation with husband Raul three weeks ago; temporally aligned with acute 3 AM insomnia and passive SI onset.", "Ally Longitudinal Graph", 0.88)
    _set_node_meta(pg, "metformin", "Metformin 1000mg BID — A1C 9.2%, chart labels patient 'non-adherent / lost to follow-up' after missed diabetes checks.", "Castle EHR Problem List", 0.82)
    _set_node_meta(pg, "belief_deserve", "Experiences uncontrolled diabetes morally as deserved consequence ('I deserve what comes') linked to mother Carmen's death from diabetes.", "Ally Longitudinal Graph", 0.90)

    _add_seeded_divergence(
        pg,
        "div-elena-kitchen",
        "back_pain",
        "kitchen_counter",
        "Kitchen Injury Attribution: Accidental Fall vs. Partner Incident Timeline",
    )
    _add_seeded_divergence(
        pg,
        "div-elena-adherence",
        "metformin",
        "belief_deserve",
        "Glycemic Non-Adherence: EHR 'Lost to Follow-Up' vs. Moral Punishment Belief",
    )
    _add_seeded_divergence(
        pg,
        "div-elena-sleep-pain",
        "tramadol",
        "sleep_disturbed",
        "Tramadol Escalation: Somatic Back Pain PRN vs. 3-Week Nocturnal Distress",
    )

    # Reset graph_version to 1 at completion of canonical seed (H3)
    pg.graph_version = 1

    # ── COMPLETE HANDOFF PACKAGE (M9, M11, H3) ──────────────────────
    handoff = HandoffPackage(
        id="handoff-elena-patel-001",
        patient_id=patient.id,
        patient_name="Elena Ramirez",
        recipient="Dr. A. Patel (Behavioral Health)",
        context="Bot-initiated referral after twelve conversations across four months. Patient explicitly accepted referral and authorized sharing with specific privacy exclusions enforced below.",
        demographics="47F • Home Health Aide (Hourly, No PTO) • Bilingual Spanish/English • Medi-Cal",
        risk_assessment={
            "level": "Medium",
            "details": "Intermittent passive suicidal ideation over 3 weeks (waking at 3 AM), safety-planned with Dr. Patel in Session 1. Temporal correlation with kitchen-counter incident with spouse Raul 3 weeks ago and tramadol overuse.",
        },
        clinical_narrative="Elena is a 47-year-old devoutly Catholic mother of three carrying four months of compounding moral, relational, and somatic distress. While her EHR characterizes her as 'lost to follow-up' with poorly controlled Type 2 diabetes (A1C 9.2%), chronic back pain, and three prior discontinued therapy referrals, longitudinal Ally sessions reveal that she experiences her illness morally ('I deserve what comes') in the shadow of her mother Carmen's death from diabetes. Her acute crisis centers on two converging threads: three weeks of 3:00 AM insomnia following a kitchen-counter incident with her husband Raul, and intense grief and shame over realizing she has secretly hoped her estranged gay son Daniel's upcoming marriage to Marco does not happen so she is not forced to choose between her child and her Catholic faith.",
        active_themes=[
            "Acute moral-relational conflict over son Daniel's anticipated wedding to Marco vs. Catholic faith teachings (June 19 birthday approaching)",
            "Three-week 3:00 AM sleep maintenance insomnia temporally aligned with kitchen-counter incident with spouse Raul",
            "Diabetes (A1C 9.2%) and irregular metformin adherence organized around redemptive-suffering and self-punishment beliefs",
            "Active safety plan with Dr. Patel for intermittent passive SI; weekly bilingual therapy focused on Daniel and faith integration",
        ],
        metadata_shadows=[
            "Patient-locked trauma node: 1 childhood family node ('the thing with my father') explicitly withheld by patient — acknowledge boundary, do not probe.",
            "Patient-excluded medication/substance boundary: 1 undisclosed self-medication node excluded from clinician view per patient consent.",
            "Therapist-locked clinical node: Specifics of age-12 religious counseling locked by Dr. Patel (bot holds boundary only).",
        ],
        excluded_content_flag=True,
        quotes_vs_inferences=[
            {
                "quote": "I have not been sleeping. Three weeks now. I wake up at three. I cannot fall back. I just lie there.",
                "inference": "Sleep-maintenance insomnia onset maps directly to the three-week mark of the kitchen-counter incident with Raul.",
            },
            {
                "quote": "What I have actually been praying... is that God will make him different. So that I do not have to be the mother who cannot come to her son's wedding.",
                "inference": "Profound dialectical split between maternal love for Daniel and rigid religious-cognitive schema formed in youth.",
            },
            {
                "quote": "I have tried therapy three times. It did not work.",
                "inference": "High dropout risk if forced to repeat cold-start intake; warm longitudinal handoff prevents starting from zero.",
            },
        ],
        simplified_graph_mermaid='graph TD;\n  Elena["Elena (47F)"] --> Sleep["Sleep Disturbed (3 wk)"];\n  Sleep --> Kitchen["Kitchen Incident (Raul)"];\n  Elena --> Daniel["Son Daniel (Birthday Jun 19)"];\n  Daniel --> Wedding["Anticipated Wedding to Marco"];\n  Wedding --> Faith["Catholic Faith / Secret Hope"];\n  Elena --> Diabetes["Type 2 Diabetes (A1C 9.2)"];\n  Diabetes -->Carmen["Mother Carmen (Deceased)"];',
        hypotheses=[
            ClinicalHypothesis(
                id="hyp-elena-01",
                text="Sofia's recently recognized depression may be functioning as an emotional mirror Elena cannot look into directly.",
                status="open",
                generated_by="gemini-2.5-flash",
                model_version="ally-v1.1",
                confirmed_by=None,
                timestamp="2026-05-14T15:35:00Z",
                updated_at="2026-05-14T15:35:00Z",
                edge_source="sofia",
                edge_target="sofia_mirror",
            ).model_dump(),
            ClinicalHypothesis(
                id="hyp-elena-02",
                text="Catholic theology of redemptive suffering ('suffering is what love costs') is operating as a cognitive defense obscuring escalating partner-conflict dynamics with Raul.",
                status="open",
                generated_by="gemini-2.5-flash",
                model_version="ally-v1.1",
                confirmed_by=None,
                timestamp="2026-05-14T15:35:00Z",
                updated_at="2026-05-14T15:35:00Z",
                edge_source="kitchen_counter",
                edge_target="belief_cannot_tell",
            ).model_dump(),
            ClinicalHypothesis(
                id="hyp-elena-03",
                text="Age-12 religious counseling experience anchors the 'if I am good God will fix' belief governing Elena's 3-year prayer struggle over Daniel.",
                status="confirmed",
                generated_by="gemini-2.5-flash",
                model_version="ally-v1.1",
                confirmed_by="Dr. A. Patel",
                timestamp="2026-05-12T21:45:00Z",
                updated_at="2026-05-14T15:30:00Z",
                edge_source="religious_counseling_12",
                edge_target="belief_god_will_fix",
            ).model_dump(),
        ],
        generated_at="2026-05-14T15:35:00Z",
        model="gemini-2.5-flash",
        model_version="ally-v1.1",
        graph_version=1,
    )
    graph_state = pg.get_graph_state()
    handoff.graph_nodes = graph_state.get("nodes", [])
    handoff.graph_edges = graph_state.get("edges", [])
    handoff.graph_positions = pg.get_positions()
    pg.handoffs.append(handoff)

    return pg


def _build_daniel() -> PatientGraph:
    patient = Patient(
        id="daniel-ramirez-002",
        name="Daniel Ramirez",
        age=24,
        bio="Daniel lives in Modesto with his partner Marco. He is a software engineer. Born in Atwater, graduated from CSU Stanislaus. English-dominant. Catholic upbringing, currently lapsed. Estranged from his mother for three years since coming out. Found the bot through a queer-affirming community resource list posted at his local library. Anonymous-by-default user — no identifiers beyond his first name until he chose to reactivate his Castle patient record.",
        bot_context="1 month, 9 conversations",
        anonymous=True,
        excluded_content=[],
        locked_nodes=["patel_locked_d"],
    )
    pg = PatientGraph(patient)

    positions = {
        "daniel": (555, 310),
        "mother": (280, 200), "graduation_dan": (175, 130), "mama_i_know": (130, 230),
        "holiday_texts": (215, 305), "modesto_visits": (165, 380),
        "unspoken_conv": (290, 410), "stopped_expecting": (380, 470),
        "i_miss_her": (470, 510),
        "marco_d": (800, 195), "two_years": (880, 130), "marco_disclosure": (905, 250),
        "conf_encounter": (945, 320), "condom_inconsistent": (925, 390),
        "marco_prep": (850, 440), "daniel_no_prep": (770, 480),
        "marriage_question": (830, 80), "staying_or_leaving": (695, 130),
        "testing_not_done": (690, 460), "prep_none": (595, 510), "hiv_test_old": (530, 555),
        "marco_chose_me": (460, 145), "cannot_make_mother": (380, 90),
        "i_am_tired": (590, 75), "faith_question": (670, 50),
        "modesto_apt": (200, 530), "candles_at_home": (110, 460), "lapsed_mass": (70, 380),
        "testing_agreed": (690, 530), "prep_agreed": (605, 575),
        "tran_referral": (470, 575), "patel_referral_d": (350, 555),
        "hiv_negative": (770, 555), "descovy_initiated": (855, 525),
        "patel_marco_focus": (245, 470), "patel_locked_d": (90, 540),
        "marco_visible_choice": (525, 70),
    }

    initial_nodes = [
        ("daniel", "Daniel", 30, "self"),
        ("mother", "Mother", 24, "person"),
        ("graduation_dan", "graduation\nshe attended\nalone", 16, "event"),
        ("mama_i_know", '"Mamá I know"', 18, "event"),
        ("holiday_texts", "holiday texts\nbrief", 14, "event"),
        ("modesto_visits", "visits — twice\nin 3 years", 14, "event"),
        ("unspoken_conv", "the conversation\nwe have not had", 18, "belief"),
        ("stopped_expecting", '"I have stopped\nexpecting it"', 16, "belief"),
        ("i_miss_her", '"I miss her"', 18, "belief"),
        ("marco_d", "Marco", 26, "person"),
        ("two_years", "two years\ntogether", 14, "event"),
        ("marco_disclosure", "Marco's\ndisclosure\n2 months ago", 22, "event"),
        ("conf_encounter", "work conference\nencounter", 16, "event"),
        ("condom_inconsistent", "condom use\ninconsistent", 16, "event"),
        ("marco_prep", "Marco on PrEP\n— protected", 14, "clinical"),
        ("daniel_no_prep", "Daniel not\non PrEP", 18, "clinical"),
        ("marriage_question", "marriage\nquestion", 16, "event"),
        ("staying_or_leaving", "staying or\nleaving", 18, "belief"),
        ("testing_not_done", '"the testing\nI have not done"', 22, "avoidance"),
        ("prep_none", "PrEP — none", 16, "clinical"),
        ("hiv_test_old", "HIV test\n6 months ago\nnegative", 14, "clinical"),
        ("marco_chose_me", '"Marco chose me\nvisibly when she\ncould not"', 20, "belief"),
        ("cannot_make_mother", '"I cannot make\nher be who I\nneed her to be"', 18, "belief"),
        ("i_am_tired", '"I am tired"', 14, "symptom"),
        ("faith_question", "identity-faith\nintegration\nunresolved", 16, "belief"),
        ("modesto_apt", "Modesto\napartment", 12, "life"),
        ("candles_at_home", "lights candles\nat home", 12, "faith"),
        ("lapsed_mass", "stopped\ngoing to Mass", 12, "faith"),
    ]

    for nid, label, size, kind in initial_nodes:
        x, y = positions.get(nid, (550, 310))
        pg.add_node(nid, label, kind, size, x, y)

    initial_edges = [
        ("daniel", "mother", "son of", 4),
        ("mother", "graduation_dan", "attended alone", 3),
        ("graduation_dan", "mama_i_know", "said while hugging", 3),
        ("mother", "holiday_texts", "limited to", 2),
        ("mother", "modesto_visits", "twice in 3 years", 2),
        ("modesto_visits", "unspoken_conv", "ended without it", 3),
        ("daniel", "stopped_expecting", "has", 3),
        ("daniel", "i_miss_her", "feels", 4),
        ("i_miss_her", "mother", "about", 4),
        ("cannot_make_mother", "mother", "about", 3),
        ("daniel", "marco_d", "partner", 4),
        ("marco_d", "two_years", "duration", 2),
        ("marco_d", "marco_disclosure", "made disclosure", 4),
        ("marco_disclosure", "conf_encounter", "about", 3),
        ("conf_encounter", "condom_inconsistent", "with", 3),
        ("marco_d", "marco_prep", "is on", 3),
        ("daniel", "daniel_no_prep", "is not on", 4),
        ("marco_d", "marriage_question", "discussed", 3),
        ("daniel", "staying_or_leaving", "wrestles with", 4),
        ("daniel", "testing_not_done", "has been", 4),
        ("testing_not_done", "condom_inconsistent", "risk from", 3),
        ("daniel_no_prep", "prep_none", "currently", 3),
        ("daniel", "hiv_test_old", "last tested", 2),
        ("daniel", "marco_chose_me", "holds", 4),
        ("marco_chose_me", "mother", "in contrast to", 3),
        ("daniel", "i_am_tired", "feels", 2),
        ("daniel", "faith_question", "navigates", 3),
        ("daniel", "modesto_apt", "lives in", 1),
        ("daniel", "candles_at_home", "practice", 2),
        ("daniel", "lapsed_mass", "has", 2),
        ("lapsed_mass", "faith_question", "expression of", 2),
    ]

    for src, tgt, label, weight in initial_edges:
        pg.add_edge(src, tgt, label, weight)

    pg.snapshot("initial-9-conversations", timestamp="2026-05-03T10:00:00Z", snap_id="snap-daniel-initial")

    # ── DANIEL CONVERSATION (Deterministic timestamps for H11) ──────
    conv = pg.start_conversation(
        "Daniel session 10",
        started_at="2026-05-13T20:15:00Z",
        conv_id="conv-daniel-session-10",
    )
    daniel_msgs = [
        ("daniel", "Hey.", []),
        ("bot", "Hi Daniel. Long day?", []),
        ("daniel", "Yeah. Marco is at his sister's tonight. I am alone in the apartment.", ["marco_d"]),
        ("bot", "How are you with that — being alone in the apartment tonight?", []),
        ("daniel", "It is okay. I am okay. I am thinking.", []),
        ("bot", "About what.", []),
        ("daniel", "About whether I should call my mother.", ["mother"]),
        ("bot", "Her birthday is not for another two months. What is making you think about calling now?", []),
        ("daniel", "Sofia texted me. She said Mamá has not been sleeping.", []),
        ("bot", "That is the first time Sofia has told you something about your mother in a long time.", []),
        ("daniel", "Yeah. I do not know what to do with it.", []),
        ("bot", "Tell me.", []),
        ("bot", "How are you doing with everything else? With Marco?", ["marco_d"]),
        ("daniel", "Same. We are talking. He is trying. I am trying. I do not know if I trust him yet.", []),
        ("bot", "Have you been tested?", ["testing_not_done"]),
        ("daniel", "No.", []),
        ("bot", "Daniel, can I tell you what I notice. You have not been tested. You are not on PrEP. Marco told you about the work conference two months ago. You have been having sex with Marco since then because he is your partner. You and I have talked about the testing every time we have talked for two months. You have not done it.", []),
        ("daniel", "I know.", []),
        ("bot", "Tell me what is in the way.", []),
        ("daniel", "If I am positive I will not know how to tell him. I will not know how to be in this anymore. I will not know whether to stay or go. Right now I can pretend it is not real. I can be angry at him and not be afraid for myself. If I get tested I have to know. I do not want to know yet.", ["marco_chose_me"]),
        ("bot", "I understand that. I want you to hear me say something. The not-knowing is not actually protecting you. The not-knowing is just postponing. And there is a window — a clinical window — that I want to make sure you understand.", []),
        ("daniel", "PEP.", []),
        ("bot", "PEP closes seventy-two hours after the most recent exposure. You and Marco have been sexually active during the period when his viral load was not yet suppressed. The PEP window for those exposures is closed now. I am not bringing this up to make you feel worse. I am bringing it up because going forward, what you can do is start PrEP, get tested now to know your current status, and protect yourself for everything that comes after. Marco is now undetectable. The risk going forward, if you are on PrEP and he stays adherent, is essentially zero. But you need to know your current status. And the longer you wait, the more decisions you are making in the dark.", []),
        ("daniel", "Okay.", []),
        ("bot", "Okay what?", []),
        ("daniel", "Okay let's do it.", ["testing_agreed", "prep_agreed"]),
        ("bot", "There is a clinician at Castle who I would like to set you up with. Her name — Dr. Linh Tran. She is a primary care provider but she does a lot of sexual health work and she is queer-affirming. She would handle your testing, your PrEP initiation, and ongoing care. I would share with her what you and I have talked about so you do not have to start from zero.", []),
        ("daniel", "I have not been to Castle in two years.", []),
        ("bot", "I know. We can either reactivate your existing patient record, or — if you prefer — we can keep this engagement separate from your prior chart. Some patients prefer to start fresh in a new context. You decide.", []),
        ("daniel", "Reactivate. It is fine. My mother does not look at my chart.", []),
        ("bot", "Okay. I will set up the appointment with Dr. Tran for testing and PrEP. There is one more thing I want to ask you about. Everything you have been carrying for the last two months — Marco, your mother, the question of whether to stay, the question of who you are without your faith — that is a lot to carry alone. There is also a therapist on the Castle team named Dr. Patel. She works with people doing exactly what you are doing. I think you would be good with her. Would you let me set up a separate appointment for you with her?", []),
        ("daniel", "Two appointments?", []),
        ("bot", "Two. They are separate. Dr. Tran handles the testing and PrEP. Dr. Patel handles the rest. They will not be talking to each other unless you authorize it. You stay in control.", []),
        ("daniel", "Okay. Yes.", ["tran_referral", "patel_referral_d"]),
        ("bot", "Daniel, before we end. You have been carrying a lot. Tonight you said yes to two things you have been not-saying yes to for months. I am proud of you for that. Sleep tonight if you can.", []),
        ("daniel", "Thanks.", []),
        ("bot", "Buenas noches.", []),
        ("daniel", "Buenas noches.", []),
    ]

    for idx, (sender, text, highlight) in enumerate(daniel_msgs):
        sig = text == "Okay let's do it."
        msg = ConversationMessage(
            id=f"msg-daniel-10-{idx + 1:02d}",
            sender=sender,
            text=text,
            timestamp=f"2026-05-13T20:{15 + (idx // 2):02d}:{(idx % 2) * 30:02d}Z",
            highlight=highlight,
            significance=sig,
        )
        pg.add_message(conv.id, msg)
    conv.status = "consolidated"

    # Session nodes
    session_nodes_d = [
        ("testing_agreed", "testing\nagreed", 18, "agreed"),
        ("prep_agreed", "PrEP\nagreed", 18, "agreed"),
        ("tran_referral", "Dr. Tran\nreferral", 16, "referral"),
        ("patel_referral_d", "Dr. Patel\nreferral", 16, "referral"),
    ]
    for nid, label, size, kind in session_nodes_d:
        x, y = positions.get(nid, (550, 310))
        pg.add_node(nid, label, kind, size, x, y, is_new=True)

    # Remove avoidance edge, add agreed edges
    pg.remove_edge("daniel", "testing_not_done")
    session_edges_d = [
        ("daniel", "testing_agreed", "now agreed", 3),
        ("daniel", "prep_agreed", "now agreed", 3),
        ("testing_agreed", "tran_referral", "via", 3),
        ("prep_agreed", "tran_referral", "via", 3),
        ("daniel", "patel_referral_d", "accepted", 3),
    ]
    for src, tgt, label, weight in session_edges_d:
        pg.add_edge(src, tgt, label, weight, is_new=True)

    pg.snapshot("post-session-10", timestamp="2026-05-13T20:38:00Z", snap_id="snap-daniel-session-10")

    # Consolidation additions
    x, y = positions["marco_visible_choice"]
    pg.add_node("marco_visible_choice", "avoidance =\nfear of disrupting\nwhat Marco gave", "inferred", 14, x, y, is_new=True)
    pg.add_edge("marco_chose_me", "marco_visible_choice", "inferred", 1, is_new=True, dashed=True)
    pg.add_edge("marco_visible_choice", "testing_not_done", "inferred", 1, is_new=True, dashed=True)
    pg.snapshot("post-consolidation", timestamp="2026-05-13T20:41:00Z", snap_id="snap-daniel-consolidation")

    # Clinician additions (descovy_initiated tagged as medication for accurate M10 medication extraction)
    clinician_nodes_d = [
        ("hiv_negative", "HIV neg\n(Tran, May)", 18, "clinician"),
        ("descovy_initiated", "Descovy (PrEP)\ninitiated", 18, "medication"),
        ("patel_marco_focus", "Patel: focus\non Marco\nstaying/leaving", 16, "clinician"),
        ("patel_locked_d", "therapist-only\nidentity-faith", 14, "therapist_locked"),
    ]
    for nid, label, size, kind in clinician_nodes_d:
        x, y = positions.get(nid, (550, 310))
        pg.add_node(nid, label, kind, size, x, y, is_new=True)

    clinician_edges_d = [
        ("tran_referral", "hiv_negative", "result", 3),
        ("tran_referral", "descovy_initiated", "plan", 3),
        ("patel_referral_d", "patel_marco_focus", "session 1", 3),
        ("patel_referral_d", "patel_locked_d", "locked", 1),
        ("marco_chose_me", "marco_visible_choice", "CONFIRMED by Patel", 3),
    ]
    for src, tgt, label, weight in clinician_edges_d:
        pg.add_edge(src, tgt, label, weight, is_new=True, clinician=True)

    pg.snapshot("post-clinician-sessions", timestamp="2026-05-15T14:20:00Z", snap_id="snap-daniel-clinician-1")

    # ── NODE SOURCE METADATA & SEEDED DIVERGENCES (H2, M10, M14) ────
    _set_node_meta(pg, "hiv_test_old", "Prior Castle lab result (6 months ago): HIV-1/2 Ag/Ab 4th-gen negative prior to partner's unsuppressed exposure window.", "Castle Lab Archive", 0.88, category="lab_history")
    _set_node_meta(pg, "testing_not_done", "Two months of postponed HIV testing despite inconsistent condom use after Marco's work-conference disclosure during unsuppressed viral window.", "Ally Session 10 Disclosure", 0.92, category="symptom_flag")
    _set_node_meta(pg, "marco_prep", "Partner Marco currently adherent on suppressive regimen / undetectable; Daniel initially treated partner status as sufficient protection.", "Patient Self-Report", 0.68, category="exposure_context")
    _set_node_meta(pg, "daniel_no_prep", "Daniel was PrEP-naive throughout the 2-month post-conference exposure window (PEP 72h window closed); now initiated on daily Descovy via Dr. Tran.", "Dr. L. Tran Sexual Health Intake", 0.95, category="exposure_context")
    _set_node_meta(pg, "prep_none", "Baseline PrEP status at intake: PrEP-naive prior to May initiation of Descovy.", "Castle Primary Care Intake", 0.90, category="exposure_context")
    _set_node_meta(pg, "descovy_initiated", "Descovy (emtricitabine/tenofovir alafenamide) 200mg/25mg PO daily initiated for HIV PrEP following negative May 4th-gen HIV test.", "Dr. L. Tran Prescription Record", 0.98, category="medication")
    _set_node_meta(pg, "i_am_tired", "Emotional exhaustion, rumination while alone in apartment, and relationship vigilance ('I am tired') over 2-month trust rupture.", "Ally Longitudinal Graph", 0.86, category="symptom")
    _set_node_meta(pg, "stopped_expecting", "Stated detachment from mother ('I have stopped expecting it') after three years of brief holiday texts and twice-only visits.", "Ally Session 6 Disclosure", 0.74)
    _set_node_meta(pg, "i_miss_her", "Acute longing for mother ('I miss her') and urge to call immediately after Sofia texted that Mamá has not been sleeping.", "Ally Session 10 Disclosure", 0.91)

    _add_seeded_divergence(
        pg,
        "div-daniel-testing-window",
        "hiv_test_old",
        "testing_not_done",
        "HIV Risk Window: 6-Month-Old Negative Baseline vs. 2-Month Unprotected Post-Conference Window",
    )
    _add_seeded_divergence(
        pg,
        "div-daniel-prep-protection",
        "marco_prep",
        "daniel_no_prep",
        "PrEP Coverage Assumption: Partner Undetectable Now vs. Unsuppressed Exposure Period",
    )
    _add_seeded_divergence(
        pg,
        "div-daniel-mother-estrangement",
        "stopped_expecting",
        "i_miss_her",
        "Maternal Estrangement Stance: 'Stopped Expecting It' vs. Acute Pull to Reconnect",
    )

    # Reset graph_version to 1 at completion of canonical seed (H3)
    pg.graph_version = 1

    # ── COMPLETE HANDOFF PACKAGES (M9, M10, M11, H3) ────────────────
    handoff = HandoffPackage(
        id="handoff-daniel-tran-001",
        patient_id=patient.id,
        patient_name="Daniel Ramirez",
        recipient="Dr. L. Tran (Primary Care / Sexual Health)",
        context="Bot-initiated sexual health referral. Patient accepted and authorized reactivating existing Castle record with strict family-chart confidentiality.",
        demographics="24M • Software Engineer • English-Primary • Reactivated Castle Chart (Confidential)",
        risk_assessment={
            "level": "Low",
            "details": "May 4th-gen HIV test returned NEGATIVE (Dr. Tran); daily Descovy PrEP initiated. No suicidal ideation or self-harm risk. Prior 72-hour PEP window closed; ongoing transmission risk effectively zero with PrEP adherence + partner viral suppression.",
        },
        clinical_narrative="Daniel is a 24-year-old software engineer living in Modesto with his partner of two years, Marco. Previously PrEP-naive with a negative HIV test 6 months ago, Daniel experienced a two-month period of testing avoidance following Marco's disclosure of an outside work-conference encounter and inconsistent condom use during a window when viral suppression was incomplete. After reviewing the 72-hour PEP cutoff vs. ongoing PrEP protection with Ally, Daniel agreed to immediate testing and PrEP initiation. Follow-up testing with Dr. Tran returned HIV-negative, and daily Descovy PrEP has been initiated.",
        active_themes=[
            "Completed 4th-generation HIV/STI screening (HIV-negative in May) and initiated daily Descovy PrEP",
            "Supporting daily PrEP adherence and 3-month renal/STI follow-up protocol with Dr. Linh Tran",
            "Affirming strict medical-chart confidentiality from estranged family members also seen at Castle",
        ],
        metadata_shadows=[
            "Behavioral health & family-of-origin material routed separately to Dr. A. Patel per patient's two-clinician boundary.",
        ],
        excluded_content_flag=False,
        quotes_vs_inferences=[
            {
                "quote": "Right now I can pretend it is not real. I can be angry at him and not be afraid for myself. If I get tested I have to know.",
                "inference": "Two-month testing delay was driven by fear of relationship dissolution rather than lack of biomedical literacy.",
            },
            {
                "quote": "Reactivate. It is fine. My mother does not look at my chart.",
                "inference": "Explicitly affirm HIPAA chart isolation at check-in to reinforce trust in Castle primary care.",
            },
        ],
        simplified_graph_mermaid='graph TD;\n  Daniel["Daniel (24M)"] --> Disclosure["Marco Conference Disclosure (2 mo ago)"];\n  Disclosure --> Avoidance["2-Mo Testing Avoidance"];\n  Avoidance --> Tran["Dr. Tran Referral Accepted"];\n  Tran --> HIVNeg["HIV Negative (May)"];\n  Tran --> Descovy["Descovy PrEP Initiated"];',
        hypotheses=[
            ClinicalHypothesis(
                id="hyp-daniel-tran-01",
                text="Structured 30-day PrEP adherence check-ins via Ally will prevent discontinuation during ongoing relationship stress.",
                status="open",
                generated_by="gemini-2.5-flash",
                model_version="ally-v1.1",
                confirmed_by=None,
                timestamp="2026-05-15T14:22:00Z",
                updated_at="2026-05-15T14:22:00Z",
            ).model_dump(),
        ],
        generated_at="2026-05-15T14:22:00Z",
        model="gemini-2.5-flash",
        model_version="ally-v1.1",
        graph_version=1,
    )
    graph_state = pg.get_graph_state()
    handoff.graph_nodes = graph_state.get("nodes", [])
    handoff.graph_edges = graph_state.get("edges", [])
    handoff.graph_positions = pg.get_positions()
    pg.handoffs.append(handoff)

    handoff2 = HandoffPackage(
        id="handoff-daniel-patel-002",
        patient_id=patient.id,
        patient_name="Daniel Ramirez",
        recipient="Dr. A. Patel (Behavioral Health)",
        context="Bot-initiated behavioral health referral (parallel to Dr. Tran sexual health care). Patient accepted. Strict inter-patient firewall active regarding family overlap.",
        demographics="24M • Software Engineer (Modesto) • Gay / Lapsed Catholic • English-Primary",
        risk_assessment={
            "level": "Low",
            "details": "No suicidal ideation, self-harm, or acute psychiatric crisis. Experiencing adjustment-related emotional fatigue ('I am tired'), partner trust rupture, and 3-year maternal estrangement grief. HIV status confirmed negative and Descovy PrEP active via Dr. Tran.",
        },
        clinical_narrative="Daniel is a 24-year-old gay software engineer navigating an acute relationship crossroads with his partner of two years, Marco, alongside a three-year estrangement from his devoutly Catholic mother. Following Marco's disclosure two months ago of an outside encounter at a work conference, Daniel postponed HIV testing because learning a positive result would force an immediate staying-or-leaving decision about the one person who 'chose me visibly when she could not.' Having now completed HIV testing (negative) and initiated Descovy PrEP with Dr. Tran, Daniel's behavioral health work centers on rebuilding or ending trust with Marco, processing renewed concern for his mother after his sister Sofia's text, and long-term Catholic identity-faith integration.",
        active_themes=[
            "Acute relationship decision (staying vs. leaving Marco) following work-conference betrayal and marriage discussions",
            "Three-year estrangement from Catholic mother reactivated by sister Sofia's text that Mamá is not sleeping",
            "Emotional exhaustion ('I am tired') from holding partner betrayal while isolated from family-of-origin support",
            "Lapsed Catholic identity-faith integration (stopped attending Mass, still lights devotional candles at home)",
        ],
        metadata_shadows=[
            "Therapist-locked clinical node: Specifics of Session 1 identity-faith processing locked by Dr. Patel (excluded from companion probing).",
            "Inter-patient family firewall: Related Castle patient exists on platform; zero cross-graph data shared in either direction.",
        ],
        excluded_content_flag=True,
        quotes_vs_inferences=[
            {
                "quote": "Marco chose me visibly when she could not.",
                "inference": "Marco functions as Daniel's primary attachment anchor following maternal estrangement, intensifying the stakes of partner betrayal.",
            },
            {
                "quote": "If I am positive I will not know whether to stay or go. Right now I can pretend it is not real.",
                "inference": "Two-month HIV testing avoidance functioned to preserve relational equilibrium; confirmed by Dr. Patel in Session 1.",
            },
            {
                "quote": "Sofia texted me. She said Mamá has not been sleeping... I do not know what to do with it.",
                "inference": "Despite stating 'I have stopped expecting it,' filial attachment remains active and responsive to family distress cues.",
            },
        ],
        simplified_graph_mermaid='graph TD;\n  Daniel["Daniel (24M)"] --> Marco["Partner Marco (2 yr)"];\n  Marco --> Betrayal["Conference Disclosure (2 mo ago)"];\n  Betrayal --> StayLeave["Staying vs. Leaving"];\n  Daniel --> Mother["Estranged Mother (3 yr)"];\n  Mother --> MissHer["Sofia Text / I Miss Her"];\n  Daniel --> Faith["Lapsed Mass / Candles at Home"];\n  Daniel --> Descovy["HIV Neg & Descovy PrEP (Dr. Tran)"];',
        hypotheses=[
            ClinicalHypothesis(
                id="hyp-daniel-patel-01",
                text="Avoidance of HIV testing for two months was motivated by fear of disrupting the visible attachment security Marco provided after maternal estrangement.",
                status="confirmed",
                generated_by="gemini-2.5-flash",
                model_version="ally-v1.1",
                confirmed_by="Dr. A. Patel",
                timestamp="2026-05-13T20:41:00Z",
                updated_at="2026-05-15T14:20:00Z",
                edge_source="marco_chose_me",
                edge_target="marco_visible_choice",
            ).model_dump(),
            ClinicalHypothesis(
                id="hyp-daniel-patel-02",
                text="Adjustment disorder with mixed anxiety and depressed mood secondary to partner infidelity disclosure and family-of-origin estrangement.",
                status="open",
                generated_by="gemini-2.5-flash",
                model_version="ally-v1.1",
                confirmed_by=None,
                timestamp="2026-05-15T14:25:00Z",
                updated_at="2026-05-15T14:25:00Z",
            ).model_dump(),
            ClinicalHypothesis(
                id="hyp-daniel-patel-03",
                text="Home candle-lighting ritual represents an intact contemplative faith resource that can support queer-affirming spiritual integration without returning to punitive dogma.",
                status="open",
                generated_by="gemini-2.5-flash",
                model_version="ally-v1.1",
                confirmed_by=None,
                timestamp="2026-05-15T14:25:00Z",
                updated_at="2026-05-15T14:25:00Z",
            ).model_dump(),
        ],
        family_overlap_flag="Daniel's mother (Elena Ramirez) is also a patient of Dr. Patel and is a separate user on this platform. Daniel does not know. Elena does not know. Firewall is preserved. This package contains nothing about Elena. Dr. Patel's knowledge of Elena from her own work with her is separate and not breached by this handoff.",
        generated_at="2026-05-15T14:25:00Z",
        model="gemini-2.5-flash",
        model_version="ally-v1.1",
        graph_version=1,
    )
    graph_state2 = pg.get_graph_state()
    handoff2.graph_nodes = graph_state2.get("nodes", [])
    handoff2.graph_edges = graph_state2.get("edges", [])
    handoff2.graph_positions = pg.get_positions()
    pg.handoffs.append(handoff2)

    return pg
