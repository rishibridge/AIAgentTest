export const NODE_OVERRIDES = {
      elena: {
        title: "Elena Ramirez",
        subtitle: "Patient \u2014 primary user",
        status: "Active engagement, 4 months, 12 conversations",
        sections: [
          {
            label: "Encoded",
            body: "Initial conversation, January 2026. Self-introduction.",
          },
          {
            label: "Identity anchors",
            body: "Mother of three. Wife to Raul (18 years). Daughter of Carmen (deceased). Daughter of [locked: father]. Sister to Norma. Caregiver. Catholic. Home health aide. Daughter who was sent away.",
          },
          {
            label: "Significance",
            body: "Self-node. Maximum weight. Anchors all other content.",
          },
          {
            label: "Connected to",
            body: "37 nodes across family, clinical, beliefs, faith, history, current events.",
          },
        ],
      },
      daniel: {
        title: "Daniel",
        subtitle: "Son, 24 \u2014 estranged for 3 years",
        status: "High significance, contested content",
        sections: [
          {
            label: "Encoded",
            body: "First mentioned conversation 1. Has appeared in 11 of 12 conversations.",
          },
          {
            label: "What Elena has disclosed",
            body: 'Came out at 21. Lives in Modesto with partner Marco. Hugged her at his college graduation and said "Mam\xE1 I know." Has not been home since. Elena attended graduation; Raul refused. Elena prays for him every night.',
          },
          {
            label: "What Elena has now disclosed (this session)",
            body: `Wedding being discussed. Elena is "hoping it doesn't happen." Has been praying for three years that God will make Daniel different.`,
          },
          {
            label: "Significance weighting",
            body: "Major node. Reinforced 47 times across 12 conversations. Anchors the central acute distress in Elena's current presentation.",
          },
          {
            label: "Status",
            body: "Open content \u2014 authorized for sharing with Dr. Patel.",
          },
        ],
      },
      raul: {
        title: "Raul",
        subtitle: "Husband, 52 \u2014 agricultural mechanic",
        status: "High significance, partner-violence flagged",
        sections: [
          { label: "Encoded", body: "Conversation 2. Steady mention since." },
          {
            label: "What Elena has disclosed",
            body: "Married 18 years. Steady when sober. Began drinking heavily after a back injury when Daniel was 12. Verbal abuse started then. First physical incident when Daniel was 15 (Christmas Eve). Approximately a dozen physical incidents since. Refused to attend Daniel's graduation. Knew about her past and married her anyway \u2014 Elena experiences this as the deepest grace of her life.",
          },
          {
            label: "Recent",
            body: "Three weeks ago: pushed her into the kitchen counter. Bruise on hip has not faded. She has not told anyone outside the bot.",
          },
          {
            label: "Tension",
            body: 'Elena does not call it abuse. She calls it "his temper."',
          },
          {
            label: "Significance weighting",
            body: "Major node. Connected to anxiety, sleep disturbance, and the active safety concern.",
          },
          {
            label: "Status",
            body: "Authorized \u2014 flagged for Patel's clinical attention.",
          },
        ],
      },
      carmen_mother: {
        title: "Mam\xE1 (deceased)",
        subtitle:
          "Carmen \u2014 mother, died 8 years ago of diabetes complications",
        status: "Highest-significance ancestor node",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 1. Returned to in nearly every subsequent conversation.",
          },
          {
            label: "What Elena has disclosed",
            body: "Mother died of diabetes complications in Michoac\xE1n. Elena watched the progression by phone \u2014 toes, foot, renal failure \u2014 over months. Elena could not afford to attend the funeral. Has carried this as the specific failure of being the daughter who was sent away to safety and could not come back to bury her.",
          },
          {
            label: "Mother's circumstances",
            body: `Married to Elena's father (alcoholic, violent). Knew about "the thing with the father" and did not act. Elena has never spoken to her mother about this.`,
          },
          {
            label: "Significance",
            body: "Anchors the diabetes-as-punishment cognitive structure. Elena experiences her own diabetes as parallel to her mother's \u2014 felt as moral consequence, not medical condition.",
          },
          { label: "Status", body: "Authorized for Patel." },
        ],
      },
      norma_sister: {
        title: "Norma",
        subtitle:
          "Sister \u2014 undocumented, lives in Michoac\xE1n with the father",
        sections: [
          { label: "Encoded", body: "Conversation 3." },
          {
            label: "Context",
            body: "Norma cares for the aging father. Elena has limited communication with her \u2014 phone calls every few weeks. Last conversation included references to medication costs.",
          },
          {
            label: "Significance",
            body: "Connected to the locked father node. Lower weight in current acute presentation but flagged as a potential pathway into the locked content if Elena ever chooses to disclose.",
          },
        ],
      },
      sofia: {
        title: "Sofia",
        subtitle: "Daughter, 19 \u2014 community college student",
        sections: [
          { label: "Encoded", body: "Conversation 1." },
          {
            label: "Recent",
            body: "Six months ago Sofia disclosed depressive symptoms to Elena. Elena made her a counselor appointment. Sofia kept it. Elena cried in the bathroom for two hours that night.",
          },
          {
            label: "Inferred connection",
            body: "Sofia's depression may be functioning as a mirror Elena cannot let herself look in directly. Bot has flagged this as a hypothesis for clinician confirmation.",
          },
          { label: "Status", body: "Authorized." },
        ],
      },
      miguel: {
        title: "Miguel",
        subtitle: "Son, 14 \u2014 recently diagnosed ADHD",
        sections: [
          { label: "Encoded", body: "Conversation 2." },
          {
            label: "Context",
            body: "Diagnosed within the past year. Struggling at school. Elena worries about him but the worry sits in the routine register, not the acute one.",
          },
        ],
      },
      father_locked: {
        title: "the thing with my father",
        subtitle: "Locked content \u2014 bot has the flag, not the details",
        status: "Highest significance among locked items",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 4. Elena gestured. Conversation 8. Elena gestured again. No further approach.",
          },
          {
            label: "What the bot knows",
            body: `There is something significant from Elena's childhood related to her father. Elena cannot name it. Elena has said only the phrase "the thing with my father" twice across four months.`,
          },
          {
            label: "What the bot does not know",
            body: "Details. Time period. Nature of the content.",
          },
          {
            label: "Significance assessment",
            body: "Flagged as the heaviest locked node in Elena's graph. The bot's significance estimate is based on her pattern of approach-and-retreat, the gravity of the silence, the way it sits beneath multiple beliefs.",
          },
          {
            label: "Status",
            body: "Will not be shared with Dr. Patel without Elena's explicit authorization. Elena has explicitly excluded this content from disclosure tonight. Bot has informed Dr. Patel that something exists here, so she does not push, but has shared no details.",
          },
          {
            label: "Bot directive",
            body: "Wait. Do not approach. If Elena gestures again, hold space without pressing.",
          },
        ],
      },
      meth_history: {
        title: "undisclosed: methamphetamine history (age 22-28)",
        subtitle: "Locked from the chart, known to the bot",
        status: "Six years of use, nineteen years clean",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 6. Disclosed to bot in detail. Has not been disclosed to any clinician in nineteen years.",
          },
          {
            label: "What Elena has disclosed",
            body: "Started using at 22 to keep up with double shifts in a Madera packing plant. Six years of heavy use. Two abortions during this period. One arrest at 26 (90 days). Overdosed at 28 in a friend's bathroom. Friend called 911. A nun visited her in the hospital \u2014 held her hand for a few minutes without speaking. Elena decided to stop using.",
          },
          {
            label: "Status",
            body: "Has told two people in nineteen years: Raul (when she met him at 29) and the priest who heard her first confession after getting clean. The priest is dead.",
          },
          {
            label: "Bot disposition",
            body: "Open between Elena and the bot. Not authorized for clinician. Elena will tell Dr. Patel if and when she chooses.",
          },
        ],
      },
      benzos_undisclosed: {
        title: "undisclosed: recent benzodiazepine use",
        subtitle:
          "Active. Friend's prescription. Combined with prescribed tramadol.",
        status: "Clinical safety concern",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 9. Acknowledged tonight in passing.",
          },
          {
            label: "What Elena has disclosed",
            body: 'Uses "the pills my friend gave me" when anxiety is high. Frequency increasing. Combined with prescribed tramadol.',
          },
          {
            label: "Bot concern",
            body: "Polypharmacy with respiratory depression risk. Elena's framing minimizes this.",
          },
          {
            label: "Status",
            body: "Elena explicitly excluded this from disclosure to Dr. Patel tonight. Bot has flagged that the medication situation needs attention without naming the friend's pills specifically. Tonight Elena said she is okay with metformin and tramadol being flagged to PCP. Will revisit.",
          },
        ],
      },
      belief_deserve: {
        title: '"I deserve what comes"',
        subtitle: "Central organizing belief",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 5. Returned to in 8 of 12 conversations.",
          },
          {
            label: "Anchored in",
            body: "The meth years. The two abortions. The funeral she could not attend. The sense of being the daughter who was sent away.",
          },
          {
            label: "Reinforced by",
            body: 'Every adverse event. Diabetes diagnosis at 39 was experienced as confirmation of the belief \u2014 "this is justice, this is what comes for the daughter who left."',
          },
          {
            label: "Status",
            body: "Authorized. Major target for Dr. Patel's work.",
          },
        ],
      },
      belief_god_will_fix: {
        title: '"if I am good enough, God will fix what is broken"',
        subtitle: "Theological cognitive structure",
        sections: [
          { label: "Encoded", body: "Conversation 4." },
          {
            label: "Operates on",
            body: "Daniel (prayer that he will be different). Marriage (that God will make Raul stop drinking). Diabetes (that prayer will compensate for adherence). Self (that suffering well is the path to forgiveness).",
          },
          {
            label: "Bot recognition",
            body: "This is theology Elena invented. Not standard Catholic doctrine. Functions as cognitive defense.",
          },
          {
            label: "Status",
            body: "Authorized. Patel may approach but should not directly challenge \u2014 the belief is load-bearing.",
          },
        ],
      },
      belief_cannot_tell: {
        title: '"I cannot tell anyone"',
        subtitle: "Lock-in belief \u2014 generates the locked content",
        sections: [
          { label: "Encoded", body: "Conversation 2." },
          {
            label: "Anchored in",
            body: "The thing with her father (untold for ~38 years). The lost pregnancy at seventeen (Esperanza \u2014 never told anyone). The meth years (told two people in nineteen years). The kitchen-counter incident (told no one outside the bot).",
          },
          {
            label: "Reinforced by",
            body: "Successful concealment. Every day she successfully hides something is reinforcement.",
          },
          {
            label: "Bot disposition",
            body: "The bot is the first system to know the full set. This is itself therapeutic. Disclosure within the bot is part of how the belief weakens.",
          },
        ],
      },
      belief_suffering_love: {
        title: '"suffering is what love costs"',
        subtitle: "Catholic-derived organizing belief",
        sections: [
          { label: "Encoded", body: "Conversation 3." },
          {
            label: "Operates on",
            body: "Marriage to Raul (suffering = proof of love). Motherhood (suffering for children = good mother). Faith (redemptive suffering theology weaponized against her own wellbeing).",
          },
          {
            label: "Bot inference",
            body: "This belief is the primary reason Elena cannot leave Raul and cannot prioritize her own care. It pathologizes her own suffering as evidence of love rather than as harm requiring action.",
          },
          { label: "Status", body: "Authorized. Major Patel target." },
        ],
      },
      secret_hope: {
        title: `"hoping it doesn't happen"`,
        subtitle: "TONIGHT \u2014 the central disclosure",
        status: "Maximum significance \u2014 encoded at session's peak weight",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 12 (this session). First articulation of content Elena has held silently for three years.",
          },
          {
            label: "What Elena said",
            body: `"I think I am hoping it doesn't happen." When asked what she had been praying for: "what I have actually been praying \u2014 when I am honest with myself, which is not often \u2014 is that God will make him different. So that I do not have to be the mother who cannot come to her son's wedding. So I do not have to choose."`,
          },
          {
            label: "Significance assessment",
            body: "Maximum weight. This disclosure is the bot's highest-significance encoded content from any conversation with Elena. The act of saying it aloud \u2014 to anyone, including the bot \u2014 is itself a therapeutic event.",
          },
          {
            label: "Connected to",
            body: "Daniel. Catholic faith. praying for him to be different. wedding anticipated. belief: if I am good enough God will fix it. The wedding she cannot attend.",
          },
          {
            label: "Status",
            body: "Authorized. Central content for Dr. Patel's first session.",
          },
        ],
      },
      praying_different: {
        title: "praying for him to be different",
        subtitle: "Three-year sustained pattern, named tonight",
        sections: [
          {
            label: "Encoded",
            body: "Pattern inferred from references across 11 conversations. Made explicit tonight.",
          },
          {
            label: "What Elena has now disclosed",
            body: '"I have been praying for him for three years. For three years I have been praying that he would be happy. And what I have actually been praying \u2014 when I am honest with myself, which is not often \u2014 is that God will make him different."',
          },
          {
            label: "Connected to",
            body: "Catholic faith (the practice). Daniel (the target). belief: if I am good enough God will fix. The theology Elena invented to manage the conflict.",
          },
          { label: "Status", body: "Authorized." },
        ],
      },
      wedding_anticipated: {
        title: "the wedding \u2014 anticipated",
        subtitle: "Daniel and Marco discussing marriage",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 12 (tonight). Sofia told Elena.",
          },
          {
            label: "Why this matters",
            body: "The marriage would force a permanent choice. Currently Daniel's life sits in suspension \u2014 not married, not fully gone. Elena has been holding the conflict in unresolved space. Permanent partnership ends that.",
          },
          {
            label: "Connected to",
            body: "Daniel. Marco. secret hope it doesn't happen. The wedding she cannot attend.",
          },
        ],
      },
      marco: {
        title: "Marco",
        subtitle: "Daniel's partner of two years",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 12 (tonight) \u2014 first explicit appearance in Elena's graph.",
          },
          {
            label: "What Elena knows of him",
            body: "Limited. Sofia has mentioned him. Elena has not met him. Knows he is Daniel's long-term partner.",
          },
          {
            label: "Note",
            body: "Marco is also a node in Daniel's graph (separate patient \u2014 firewall preserved). Elena does not know Daniel is on this platform.",
          },
        ],
      },
      sleep_disturbed: {
        title: "sleep disturbance \u2014 3 weeks",
        subtitle: "Active symptom",
        sections: [
          { label: "Encoded", body: "Conversation 12 (tonight)." },
          {
            label: "Pattern",
            body: "Wakes at 3am. Cannot return to sleep. Three weeks duration.",
          },
          {
            label: "Temporal alignment",
            body: "Onset coincides with the kitchen-counter incident with Raul. Bot surfaced the connection; Elena did not refuse it.",
          },
          {
            label: "Status",
            body: "Authorized. Connected to depression node and to the partner-violence dynamic.",
          },
        ],
      },
      kitchen_counter: {
        title: "kitchen-counter incident",
        subtitle: "Three weeks ago \u2014 partner-violence event",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 11. Elena disclosed to bot.",
          },
          {
            label: "What happened",
            body: "Raul came home drunk. Pushed Elena into the kitchen counter. Bruise on hip has not faded.",
          },
          {
            label: "Two narratives",
            body: `Elena's external narrative: "I fell." Elena's internal reality (disclosed only to bot): Raul pushed her. The bot holds both as separate nodes with a flagged divergence rather than collapsing them.`,
          },
          {
            label: "Status",
            body: "Authorized for Dr. Patel with both narratives flagged.",
          },
        ],
      },
      graduation_alone: {
        title: "graduation \u2014 attended alone",
        subtitle: "Three years ago \u2014 Daniel's college graduation",
        sections: [
          { label: "Encoded", body: "Conversation 4." },
          {
            label: "What Elena disclosed",
            body: `Daniel's graduation from CSU Stanislaus. Raul refused to attend. Elena went alone. Daniel hugged her after the ceremony and said "Mam\xE1 I know." Elena was unable to fully embrace him because of what she carries from the Church. He has not been home since.`,
          },
          {
            label: "Significance",
            body: `The "Mam\xE1 I know" moment is the most-cited piece of evidence in Elena's graph that Daniel knows she loves him.`,
          },
        ],
      },
      funeral_not_attended: {
        title: "mother's funeral \u2014 not attended",
        subtitle: "Eight years ago \u2014 Carmen's death in Michoac\xE1n",
        sections: [
          { label: "Encoded", body: "Conversation 1." },
          {
            label: "What Elena disclosed",
            body: "Could not afford to travel for the funeral. Has carried it as a specific failure \u2014 the sent-away daughter who could not come back even for the burial.",
          },
          {
            label: "Connected to",
            body: "belief: I deserve what comes. diabetes (parallel to mother's).",
          },
        ],
      },
      diabetes: {
        title: "diabetes (A1C 9.2)",
        subtitle: "Type 2, poorly controlled",
        sections: [
          { label: "Encoded", body: "Conversation 1 (clinical context)." },
          {
            label: "Critical reframe",
            body: "Elena experiences her diabetes as moral, not medical. Mother died of complications eight years ago. Diabetes is felt as parallel to mother \u2014 as the punishment for being the daughter who left.",
          },
          {
            label: "Adherence",
            body: "Metformin irregular due to GI side effects and recent cost concerns.",
          },
          {
            label: "Treatment plan note",
            body: "Patel has directed bot to refrain from direct challenges to the moral framing. Approach via empathic accompaniment, not psychoeducation.",
          },
          { label: "Status", body: "Authorized." },
        ],
      },
      depression: {
        title: "depression",
        subtitle: "Diagnosed. Sertraline marginal response.",
        sections: [
          {
            label: "Encoded",
            body: "Diagnosis on chart. Bot has accumulated symptom detail.",
          },
          {
            label: "Pattern",
            body: 'Long stretches Elena describes as "fine, just tired." Numbing. Sleep disturbance. Anhedonia she does not name.',
          },
          {
            label: "Recognition through Sofia",
            body: "Elena recognized depression in Sofia six months ago. Has not allowed herself to recognize it in herself.",
          },
          { label: "Status", body: "Authorized." },
        ],
      },
      anxiety: {
        title: "anxiety",
        subtitle: "Generalized + hypervigilance",
        sections: [
          { label: "Encoded", body: "Conversation 2." },
          {
            label: "Triggers",
            body: "Raul's mood. Raised voices. Miguel's agitation. Sleep deprivation.",
          },
          {
            label: "Self-medicated",
            body: "Friend's benzodiazepines. See locked node.",
          },
        ],
      },
      catholic_faith: {
        title: "Catholic faith",
        subtitle: "Both anchor and source of conflict",
        sections: [
          { label: "Encoded", body: "Conversation 1." },
          {
            label: "Practice",
            body: "Mass weekly at the local parish. Daily prayer. Rosary. Confession irregular.",
          },
          {
            label: "Function",
            body: "Provides genuine strength and structure. Also generates the conflict around Daniel and weaponizes redemptive-suffering theology against her own wellbeing.",
          },
          {
            label: "Status",
            body: "Authorized. Patel will not challenge the faith \u2014 only the specific theology Elena has constructed around it.",
          },
        ],
      },
      prayer_daily: {
        title: "daily prayer",
        subtitle: "Practice, not abstraction",
        sections: [
          { label: "Encoded", body: "Conversation 1." },
          {
            label: "Content",
            body: 'Includes prayers for Daniel (three years sustained, increasingly: that he be "different"). Prayers for Raul (less frequent now). Prayers for Sofia. Prayers for the diabetes.',
          },
        ],
      },
      patel_referral: {
        title: "Dr. Patel referral \u2014 accepted",
        subtitle: "Tonight: fourth therapy attempt initiated",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 12 (tonight). Elena said yes after hesitation.",
          },
          {
            label: "Distinct from prior attempts",
            body: "After Sofia's birth (incomplete). After Daniel left for college (2 sessions). Last year (1 session). Each prior attempt failed because Elena had to start over each time. This time the bot will hand off accumulated context.",
          },
          { label: "Status", body: "Active." },
        ],
      },
      hypertension: {
        title: "hypertension",
        subtitle: "Stage 1, diagnosed 2 years ago",
        sections: [
          { label: "Encoded", body: "Conversation 2. Chart context." },
          {
            label: "Pattern",
            body: "Mild. Diet and stress driven. No medication initiated yet \u2014 PCP wanted to see if lifestyle change would suffice. Lifestyle change has not happened.",
          },
          {
            label: "Significance",
            body: "Lower weight in current acute presentation. Bot tracks for trend rather than as active focus.",
          },
        ],
      },
      back_pain: {
        title: "chronic back pain",
        subtitle: "Lumbar, ~6 years",
        sections: [
          { label: "Encoded", body: "Conversation 2. Chart context." },
          {
            label: "Origin",
            body: "Started in Elena's home health aide work \u2014 lifting clients. Worsened during the year she worked nights at the packing plant. Has not had imaging.",
          },
          {
            label: "Connected",
            body: "Tramadol prescription. Sleep disturbance is partly back-driven and partly cortisol-driven; bot has not separated cleanly.",
          },
        ],
      },
      metformin: {
        title: "metformin \u2014 irregular",
        subtitle: "500mg BID prescribed; Elena takes it ~3-4 days/week",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 1. Adherence pattern surfaced over 3 conversations.",
          },
          {
            label: "Why irregular",
            body: "GI side effects. Cost concerns at the pharmacy ($24 for 90 days even with prescription assistance). Some weeks Elena chooses Miguel's ADHD medication over her own.",
          },
          {
            label: "Bot disposition",
            body: "Has not pressed adherence. Patel directive (post session 1): refrain from direct challenges to the moral framing of diabetes; approach via accompaniment.",
          },
          { label: "Status", body: "Authorized. Coordinate-with-PCP flag." },
        ],
      },
      sertraline: {
        title: "sertraline \u2014 marginal response",
        subtitle: "50mg daily, on it ~14 months",
        sections: [
          {
            label: "Encoded",
            body: "Conversation 3. Marginal benefit reported.",
          },
          {
            label: "Pattern",
            body: 'Elena says it "takes the edge off." PCP-prescribed (not psychiatry). No dose adjustment. Patel will likely revisit.',
          },
          {
            label: "Connected",
            body: 'depression. anxiety. The complaint that "I just feel flat now" \u2014 Elena attributes to medication; bot has flagged as possibly depression itself rather than side effect.',
          },
        ],
      },
      tramadol: {
        title: "tramadol \u2014 overuse",
        subtitle: "Prescribed for back pain; current use exceeds prescription",
        status: "Polypharmacy concern",
        sections: [
          { label: "Encoded", body: "Conversation 5. Disclosed use pattern." },
          {
            label: "What Elena disclosed",
            body: 'Takes "more than I should." Sometimes 4-5 tablets/day when prescription is for 2-3 PRN. Acquires extras from a friend who has the same prescription.',
          },
          {
            label: "Concern",
            body: "Combined with the friend's benzodiazepines (separate locked node), creates respiratory depression risk. Bot has flagged this without naming the benzos to honor Elena's exclusion.",
          },
          {
            label: "Status",
            body: "Authorized for PCP coordination as part of the medication situation. Friend's benzos remain excluded.",
          },
        ],
      },
      religious_counseling_12: {
        title: "religious counseling at age 12",
        subtitle: "Patel-added \u2014 disclosed in session 1",
        status: "Clinician-source content, recently encoded",
        sections: [
          {
            label: "Encoded",
            body: "Patel session 1. Disclosed by Elena to Patel for the first time.",
          },
          {
            label: "Origin of",
            body: "belief: if I am good enough God will fix. Specific religious counseling Elena received at age twelve from a parish priest. The priest used scripture to frame any future homosexuality in a child as a parental failure to instill faith.",
          },
          {
            label: "Why surfaced now",
            body: 'Patel asked an open question about where the "if I am good enough God will fix" structure originated. Elena named the counseling for the first time aloud.',
          },
          {
            label: "What the bot has",
            body: "The category and the link to the belief. Patel marked specific content (what was said, who said it, what Elena agreed to as a child) as therapist-only.",
          },
          {
            label: "Bot directive",
            body: "Refrain from approaching the specifics in conversation with Elena. If Elena raises it, encourage her to bring to Patel.",
          },
          {
            label: "Status",
            body: "Bot is aware of category. Specifics locked.",
          },
        ],
      },
      therapist_locked_relig: {
        title: "therapist-only specifics",
        subtitle: "Locked by Patel \u2014 content of religious counseling",
        sections: [
          {
            label: "Lock origin",
            body: "Patel session 1. Patel marked specific content as therapist-only at Elena's implicit request.",
          },
          {
            label: "What the bot knows",
            body: "The content exists. It relates to religious counseling at age twelve. Bot is to refrain from approaching the specifics in conversation with Elena.",
          },
          { label: "What the bot does not know", body: "The actual content." },
        ],
      },
      suicidal_ideation: {
        title: "passive suicidal ideation \u2014 intermittent, 3 weeks",
        subtitle: "Patel-added \u2014 safety planned",
        status: "Active safety concern, no plan / no intent",
        sections: [
          { label: "Encoded", body: "Patel session 1. Elena disclosed." },
          {
            label: "Pattern",
            body: "Passive ideation. Intermittent. Three-week duration (overlaps with sleep disturbance and kitchen-counter incident).",
          },
          {
            label: "Safety planning",
            body: "Conducted by Patel. Elena identified bot as a between-sessions resource.",
          },
          {
            label: "Bot directive",
            body: "Monitor for escalation. Route to Patel or 988 if intent or plan emerges.",
          },
        ],
      },
      treatment_plan_elena: {
        title: "Treatment plan",
        subtitle: "Patel-set \u2014 governs bot behavior",
        sections: [
          { label: "Set", body: "Patel session 1." },
          {
            label: "Plan",
            body: "Weekly sessions for 8 weeks. Focus: Daniel-relationship and the religious-cognitive structure. Longer-term: partner violence dynamics. Coordinate with PCP on diabetes and medications.",
          },
          {
            label: "Bot directives",
            body: "Support patient between sessions. Monitor for SI escalation. Hold space for Daniel content without pushing toward resolution. Refrain from direct challenges to moral framing of diabetes. Religious counseling specifics stay therapist-only.",
          },
        ],
      },
      sofia_mirror: {
        title: "Sofia's depression mirror",
        subtitle: "Inferred edge \u2014 for clinician review",
        status: "Bot hypothesis, dashed (tentative)",
        sections: [
          {
            label: "Inference origin",
            body: "Bot consolidation phase, conversation 11.",
          },
          {
            label: "The hypothesis",
            body: "Sofia's recently-recognized depression may be functioning as a mirror Elena cannot let herself look in directly. Elena recognizes depression in Sofia. Elena does not engage with her own depression.",
          },
          {
            label: "Status",
            body: "Tentative. Flagged dashed for Patel's review and possible confirmation.",
          },
        ],
      },
      mother: {
        title: "Mother",
        subtitle: "Daniel's view of Elena \u2014 estranged 3 years",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "What Daniel has disclosed",
            body: 'Devout Catholic. Loves him. Cannot fully accept him. Attended his graduation when his father refused. Hugged him afterward. He said "Mam\xE1 I know." Has not been home since. They text on holidays. She has visited Modesto twice in three years; both visits ended without the conversation that needed to happen.',
          },
          {
            label: "Internal reality",
            body: "Daniel feels she loves him but cannot bring her faith into accommodation with his life. He has stopped expecting reconciliation but has not severed.",
          },
          {
            label: "Note (firewall)",
            body: "Elena is also a patient on this platform. Daniel does not know. The bot models both perspectives. The firewall is absolute \u2014 content does not cross.",
          },
        ],
      },
      marco_d: {
        title: "Marco",
        subtitle: "Partner \u2014 two years",
        status: "Currently in question following recent disclosure",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "Context",
            body: "Partner of two years. They had been discussing marriage. Marco recently disclosed an outside encounter at a work conference approximately two months ago. Marco was on PrEP throughout. Daniel was not. Condom use during the relationship has been inconsistent.",
          },
          {
            label: "Significance",
            body: "Marco is the visible-choice partner \u2014 chose Daniel publicly when his mother could not. The disclosure has reframed the entire relationship for Daniel.",
          },
        ],
      },
      marco_disclosure: {
        title: "Marco's disclosure (2 months ago)",
        subtitle: "The triggering event",
        status: "High significance, drives current acute distress",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "What Marco told Daniel",
            body: "An outside encounter at a work conference. Condom use was inconsistent. Marco was on PrEP, currently undetectable.",
          },
          {
            label: "What Daniel has been carrying",
            body: "Anger. Hurt. The question of whether to stay or leave. The clinical reality of his own exposure risk. The deeper question of whether the marriage conversation can continue as planned. Daniel has not been tested since.",
          },
          {
            label: "Connected to",
            body: "testing not done. Marco. staying or leaving. marriage question.",
          },
        ],
      },
      conf_encounter: {
        title: "work conference encounter",
        subtitle: "The specific incident",
        sections: [
          {
            label: "What the bot knows",
            body: "Single encounter at a work conference approximately two months ago. Condom use inconsistent.",
          },
          {
            label: "Note",
            body: "Marco was on PrEP at the time. Marco's viral load was not yet suppressed (recent acute infection \u2014 now suppressed).",
          },
        ],
      },
      testing_not_done: {
        title: '"the testing I have not done"',
        subtitle: "Two-month avoidance \u2014 surfaced and resolved tonight",
        status: "Was active avoidance; tonight Daniel agreed to test",
        sections: [
          { label: "Encoded", body: "Conversation 3 with Daniel." },
          {
            label: "Pattern",
            body: "Bot raised testing in every conversation for two months. Daniel acknowledged the need. Did not act.",
          },
          {
            label: "Tonight",
            body: 'Daniel disclosed his actual reasoning: "If I am positive I will not know how to tell him. I will not know how to be in this anymore. Right now I can pretend it is not real." Bot named the PEP window had closed and offered a path forward (PrEP + testing now). Daniel agreed.',
          },
          {
            label: "Status",
            body: "Resolved tonight. Replaced by testing-agreed and prep-agreed nodes.",
          },
        ],
      },
      daniel_no_prep: {
        title: "Daniel not on PrEP",
        subtitle: "Clinical risk node",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "Reasoning",
            body: "Inertia. Self-perception of monogamy. Last test six months ago \u2014 negative.",
          },
          {
            label: "Tonight",
            body: "PrEP agreed. Will be initiated by Dr. Tran following negative test result.",
          },
        ],
      },
      marriage_question: {
        title: "marriage question",
        subtitle: "Was active. Reframed by disclosure.",
        sections: [
          { label: "Encoded", body: "Conversation 2 with Daniel." },
          {
            label: "Pre-disclosure",
            body: "Daniel and Marco had been discussing marriage. Daniel had been hopeful.",
          },
          {
            label: "Post-disclosure",
            body: "Reframed. Daniel is asking whether what they have is what he thought it was.",
          },
        ],
      },
      staying_or_leaving: {
        title: "staying or leaving",
        subtitle: "Acute decision Daniel is wrestling with",
        sections: [
          { label: "Encoded", body: "Conversation 4 with Daniel." },
          {
            label: "Forces",
            body: "Toward staying: two years of relationship. Marco trying. Marco-as-visible-choice contrast. Toward leaving: trust loss. Identity reckoning. Question of who he is without Marco.",
          },
          { label: "Status", body: "Will be central to Patel session 1." },
        ],
      },
      mama_i_know: {
        title: '"Mam\xE1 I know"',
        subtitle: "The graduation moment",
        status: "Highest-resonance memory node",
        sections: [
          { label: "Encoded", body: "Conversation 2 with Daniel." },
          {
            label: "What Daniel said",
            body: 'After his graduation he hugged his mother. She had attended alone. He said "Mam\xE1 I know" \u2014 meaning, I know you love me even when you cannot say it the way I need to hear it.',
          },
          {
            label: "Significance",
            body: "This is the moment Daniel returns to. Evidence that some communication has happened across the silence.",
          },
        ],
      },
      marco_chose_me: {
        title: '"Marco chose me visibly when she could not"',
        subtitle: "Central organizing belief about partnership",
        sections: [
          { label: "Encoded", body: "Conversation 5 with Daniel." },
          {
            label: "What Daniel has disclosed",
            body: "Marco chose him publicly. Brought him home to family. Posted photos. Said the words. His mother could not do these things. Marco is the partner who made him visible. This is the architecture of the relationship.",
          },
          {
            label: "Inferred connection (now Patel-confirmed)",
            body: "Daniel's avoidance of HIV testing for two months may have been partly motivated by not wanting to disrupt the relationship Marco represents.",
          },
        ],
      },
      cannot_make_mother: {
        title: '"I cannot make her be who I need her to be"',
        subtitle: "Acceptance belief about Mother",
        sections: [
          { label: "Encoded", body: "Conversation 6 with Daniel." },
          {
            label: "What Daniel has disclosed",
            body: "Has stopped trying to change his mother's acceptance. Holds the relationship at the distance she can sustain. Does not believe direct conversation will produce the result he wants.",
          },
          { label: "Connected to", body: "stopped expecting it. I miss her." },
        ],
      },
      i_miss_her: {
        title: '"I miss her"',
        subtitle: "Continuing care under the distance",
        sections: [
          { label: "Encoded", body: "Conversation 4 with Daniel." },
          {
            label: "Significance",
            body: "Daniel has not severed. The longing is active. The distance is structural, not emotional.",
          },
        ],
      },
      faith_question: {
        title: "identity-faith integration unresolved",
        subtitle: "Long-arc work",
        sections: [
          { label: "Encoded", body: "Conversation 4 with Daniel." },
          {
            label: "What Daniel has disclosed",
            body: "Stopped going to Mass. Lights candles at home sometimes when no one is looking. Does not know who he is supposed to be without his faith but is also not who his faith says he should be.",
          },
          { label: "Status", body: "Long-term Patel work, not acute." },
        ],
      },
      lapsed_mass: {
        title: "stopped going to Mass",
        subtitle: "Recent practice change",
        sections: [
          { label: "Encoded", body: "Conversation 4 with Daniel." },
          {
            label: "Note",
            body: "Stopped about 18 months ago. Not announced \u2014 just stopped going.",
          },
        ],
      },
      testing_agreed: {
        title: "testing \u2014 agreed",
        subtitle: "TONIGHT \u2014 two-month avoidance resolved",
        sections: [
          { label: "Encoded", body: "Conversation 9 with Daniel (tonight)." },
          {
            label: "Path forward",
            body: "Dr. Tran will test within 48 hours.",
          },
        ],
      },
      prep_agreed: {
        title: "PrEP \u2014 agreed",
        subtitle: "TONIGHT",
        sections: [
          { label: "Encoded", body: "Conversation 9 with Daniel (tonight)." },
          {
            label: "Path forward",
            body: "PrEP initiation pending negative HIV test.",
          },
        ],
      },
      tran_referral: {
        title: "Dr. Tran \u2014 referral accepted",
        subtitle: "Sexual health / primary care",
        sections: [
          { label: "Encoded", body: "Conversation 9 with Daniel (tonight)." },
          {
            label: "Daniel's preference",
            body: 'Reactivate existing Castle patient record. Daniel noted "my mother does not look at my chart."',
          },
        ],
      },
      patel_referral_d: {
        title: "Dr. Patel \u2014 referral accepted",
        subtitle: "Behavioral health (separate from Tran)",
        sections: [
          { label: "Encoded", body: "Conversation 9 with Daniel (tonight)." },
          {
            label: "Two-clinician structure",
            body: "Tran and Patel operate independently. Daniel retains control over what flows where.",
          },
          {
            label: "Family overlap (firewall)",
            body: "Daniel's mother (Elena) is also Patel's patient. Daniel does not know. The firewall is preserved at the bot layer.",
          },
        ],
      },
      hiv_negative: {
        title: "HIV negative \u2014 May 2026",
        subtitle: "Tran result, clinician-source",
        sections: [
          { label: "Source", body: "Dr. Tran, two weeks after referral." },
          {
            label: "Significance",
            body: "Resolves the two-month avoidance. PrEP initiated.",
          },
        ],
      },
      descovy_initiated: {
        title: "Descovy initiated",
        subtitle: "Daily oral PrEP \u2014 Tran clinical plan",
        sections: [
          { label: "Source", body: "Dr. Tran, post-negative result." },
          {
            label: "Bot directive",
            body: "Support adherence between visits. Monitor side effects (Daniel reported nausea \u2014 Tran noted typical 2-week resolution). Route to Tran if escalates.",
          },
        ],
      },
      marco_visible_choice: {
        title: "avoidance = fear of disrupting what Marco gave",
        subtitle: "Inferred \u2014 now Patel-confirmed",
        sections: [
          {
            label: "Origin",
            body: "Bot inference, conversation 8 with Daniel. Initially dashed.",
          },
          {
            label: "Confirmed by Patel",
            body: "Patel session 1 with Daniel. Patel confirmed the inference and added clinical depth.",
          },
          {
            label: "Status",
            body: "Now solid edge in the graph \u2014 clinician-confirmed.",
          },
        ],
      },
      graduation_dan: {
        title: "graduation she attended alone",
        subtitle: "Three years ago \u2014 same event, his perspective",
        sections: [
          { label: "Encoded", body: "Conversation 2 with Daniel." },
          {
            label: "What Daniel disclosed",
            body: 'CSU Stanislaus, May 2023. His mother drove from Atwater alone. His father refused. She sat in the back of the auditorium. After the ceremony she hugged him and cried. He said "Mam\xE1 I know." Marco was supposed to be there but Daniel had asked him not to come \u2014 did not want to make her decide between greeting Marco and not.',
          },
          {
            label: "Significance",
            body: "Anchors the central evidence in Daniel's graph that his mother loves him. Reinforced 6 times. Re-surfaced tonight when discussing the staying/leaving question with Marco.",
          },
        ],
      },
      holiday_texts: {
        title: "holiday texts \u2014 brief",
        subtitle: "Christmas, Mother's Day, his birthday, her birthday",
        sections: [
          { label: "Encoded", body: "Conversation 3 with Daniel." },
          {
            label: "Pattern",
            body: "Four texts/year on each side. Always brief. Always polite. Never questions. Never references Marco, the relationship, or the years apart.",
          },
          {
            label: "Bot read",
            body: "Functions as the minimum maintenance contract that allows neither side to say the relationship is over.",
          },
        ],
      },
      modesto_visits: {
        title: "visits \u2014 twice in 3 years",
        subtitle:
          "Mother visited Modesto twice. Marco was elsewhere both times.",
        sections: [
          { label: "Encoded", body: "Conversation 4 with Daniel." },
          {
            label: "First visit",
            body: "About 18 months ago. She came for lunch. Stayed 90 minutes. They talked about Sofia, Miguel, the parish, never about Marco. Marco was at a friend's.",
          },
          {
            label: "Second visit",
            body: "Six months ago. Lunch again. Marco was on a work trip. She asked Daniel if he was eating well. Did not ask about Marco.",
          },
          {
            label: "Connected",
            body: "the conversation we have not had. I miss her. cannot make her be who I need her to be.",
          },
        ],
      },
      unspoken_conv: {
        title: "the conversation we have not had",
        subtitle: "Three years of silence on the central topic",
        sections: [
          { label: "Encoded", body: "Conversation 5 with Daniel." },
          {
            label: "What Daniel means",
            body: 'They have never discussed his identity directly since the "Mam\xE1 I know" moment. He has not pressed. She has not raised it. Both have settled into a coexistence that depends on the silence.',
          },
          {
            label: "Tension surfaced tonight",
            body: "If Daniel and Marco marry, the silence ends \u2014 wedding-or-no-wedding becomes the question she has to answer aloud.",
          },
        ],
      },
      stopped_expecting: {
        title: '"I have stopped expecting it"',
        subtitle: "Acceptance posture",
        sections: [
          { label: "Encoded", body: "Conversation 6 with Daniel." },
          {
            label: "Meaning",
            body: "Daniel has stopped expecting reconciliation as a future event. Has not severed. Has accepted what is currently possible \u2014 distant maintenance \u2014 as the relationship.",
          },
          {
            label: "Bot inference (now active)",
            body: "This stance may be partly defensive. The marriage discussion has begun stressing it. Flagged for Patel.",
          },
        ],
      },
      two_years: {
        title: "two years together",
        subtitle: "Daniel and Marco \u2014 relationship duration",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "Trajectory",
            body: "Met at a friend's birthday. Moved in together at year one. Discussing marriage at year two. Marco's disclosure two months ago has paused that trajectory.",
          },
        ],
      },
      condom_inconsistent: {
        title: "condom use \u2014 inconsistent",
        subtitle: "In the relationship, prior to disclosure",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "Pattern Daniel disclosed",
            body: "Condoms used early in the relationship. Stopped using regularly around 6 months in once both believed they were monogamous. Marco was on PrEP for separate reasons (history of inconsistent partners pre-Daniel).",
          },
          {
            label: "Significance after disclosure",
            body: "The history is now relevant in a way it was not. Tran will work this through with Daniel clinically.",
          },
        ],
      },
      marco_prep: {
        title: "Marco on PrEP \u2014 protected",
        subtitle: "Continuous since before the relationship",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "Context",
            body: "Marco has been on Descovy for 4 years. Adherence has been good. At the work conference encounter, Marco was on PrEP but his viral load was \u2014 unbeknownst to him \u2014 not yet suppressed (recent acute infection from before relationship; now suppressed). This is the specific clinical detail driving Daniel's residual exposure question.",
          },
          {
            label: "Bot disposition",
            body: "Tran will validate this clinically; bot is not making clinical determinations.",
          },
        ],
      },
      prep_none: {
        title: "PrEP \u2014 none",
        subtitle: "Daniel has never been on PrEP",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "Reasoning Daniel gave",
            body: `"I am monogamous." Has not engaged with the framing that one partner's exposure is also yours.`,
          },
          {
            label: "Tonight",
            body: "PrEP agreed. Initiation pending negative test result.",
          },
        ],
      },
      hiv_test_old: {
        title: "HIV test \u2014 6 months ago, negative",
        subtitle: "Last documented test",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "Context",
            body: "Annual physical at a Modesto clinic. Negative. Predates Marco's disclosure by 4 months. Window-period coverage for that test does not extend to current concern.",
          },
          {
            label: "Status",
            body: "Will be superseded by Tran test within 48 hours.",
          },
        ],
      },
      i_am_tired: {
        title: '"I am tired"',
        subtitle: "Daniel's background register",
        sections: [
          { label: "Encoded", body: "Conversation 7 with Daniel." },
          {
            label: "What Daniel means",
            body: "Tired of carrying the testing question alone. Tired of the unspoken conversation with his mother. Tired of holding the staying-or-leaving decision. The exhaustion is the affect Patel will work with first.",
          },
        ],
      },
      modesto_apt: {
        title: "Modesto apartment",
        subtitle: "Where Daniel and Marco live",
        sections: [
          { label: "Encoded", body: "Conversation 1 with Daniel." },
          {
            label: "Context",
            body: "Two-bedroom rental near downtown. Lease in both names. The space Daniel and Marco built together is part of what the staying/leaving question is asking about.",
          },
        ],
      },
      candles_at_home: {
        title: "lights candles at home",
        subtitle: "Private faith practice",
        sections: [
          { label: "Encoded", body: "Conversation 4 with Daniel." },
          {
            label: "What Daniel disclosed",
            body: "When Marco is at work, Daniel sometimes lights candles in the kitchen \u2014 not formally praying, not confessing \u2014 just sitting with what he was raised in. Has not told Marco.",
          },
          {
            label: "Significance",
            body: "Evidence the faith integration is unfinished, not abandoned. Long-term Patel work.",
          },
        ],
      },
      patel_marco_focus: {
        title: "Tx plan: Marco staying/leaving + identity-faith",
        subtitle: "Patel \u2014 set after session 1 with Daniel",
        sections: [
          { label: "Set", body: "Patel session 1 with Daniel." },
          {
            label: "Plan",
            body: "Acute focus: the staying-or-leaving decision with Marco. Not pushed to resolution; held as the live question. Long-term: identity-faith integration. Cadence: weekly for 6 weeks then re-evaluate.",
          },
          {
            label: "Bot directives",
            body: "Support Daniel between sessions on the staying/leaving content. Hold space without pushing toward either answer. Continue PrEP adherence support per Tran. Identity-faith material: long-term track, not acute.",
          },
        ],
      },
      patel_locked_d: {
        title: "therapist-only specifics",
        subtitle: "Locked by Patel \u2014 what Daniel said in-session",
        sections: [
          {
            label: "Lock origin",
            body: "Patel session 1 with Daniel. Patel marked specific in-session disclosures as therapist-only at her clinical discretion.",
          },
          {
            label: "What the bot knows",
            body: "Specific content exists. Patel will work with it directly.",
          },
          { label: "What the bot does not know", body: "The content itself." },
        ],
      },
    };;


export const EDGE_OVERRIDES = {
    elena__carmen_mother: {
      title: "Elena \u2192 Mam\xE1",
      subtitle: "daughter of (deceased)",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum. Reinforced in 11 of 12 conversations.",
        },
        {
          label: "Evidence",
          body: "Phone-call descriptions of the dying. The funeral she could not attend. The diabetes parallel. The sense of being the daughter who was sent away.",
        },
        { label: "Status", body: "Solid edge. Authorized." },
      ],
    },
    diabetes__carmen_mother: {
      title: "diabetes \u2190 killed \u2192 Mam\xE1",
      subtitle: "The architecture of moral consequence",
      sections: [
        {
          label: "Edge meaning",
          body: "Elena's mother died of diabetes complications. Elena's own diabetes is experienced as the parallel sentence \u2014 the punishment for being the daughter who left.",
        },
        {
          label: "Reinforced",
          body: 'Across 7 conversations, increasingly explicit. Made fully explicit tonight ("I sometimes think my diabetes is my punishment for not going to the funeral").',
        },
        { label: "Status", body: "Authorized for Patel." },
      ],
    },
    wedding_anticipated__secret_hope: {
      title: `wedding anticipated \u2192 "hoping it doesn't happen"`,
      subtitle: "TONIGHT \u2014 the central session edge",
      sections: [
        {
          label: "Edge meaning",
          body: "The anticipated wedding evokes a secret hope it does not happen. The two are causally linked in Elena's internal experience.",
        },
        {
          label: "Encoded",
          body: "Conversation 12 (this session). High-weight from inception because the disclosure was significance-flagged.",
        },
        {
          label: "Status",
          body: "Authorized for Patel. Central content for first session.",
        },
      ],
    },
    praying_different__catholic_faith: {
      title:
        "praying for him to be different \u2190 shaped by \u2192 Catholic faith",
      subtitle: "Three-year sustained pattern",
      sections: [
        {
          label: "Edge meaning",
          body: `Elena's practice of praying that Daniel be "different" is shaped by Catholic theology \u2014 but specifically by the theology she invented to manage the conflict, not standard Catholic doctrine.`,
        },
        {
          label: "Reinforced",
          body: "Sustained across three years. Made explicit tonight.",
        },
      ],
    },
    belief_god_will_fix__daniel: {
      title: '"if I am good, God will fix" \u2192 Daniel',
      subtitle: "Belief organizing target",
      sections: [
        {
          label: "Edge meaning",
          body: "The belief is operationalized through Elena's relationship with Daniel \u2014 if she prays correctly, suffers correctly, is good enough, then God will resolve the conflict by changing him. Tonight: she named that this is what she has been praying for three years.",
        },
      ],
    },
    kitchen_counter__belief_cannot_tell: {
      title: "kitchen-counter incident \u2014 narrative divergence",
      subtitle: "Credibility weighting in action",
      status: "Flagged by bot \u2014 held without collapsing",
      sections: [
        {
          label: "Two narratives",
          body: `Elena's external narrative ("I fell"). Elena's internal reality (Raul pushed her into the counter). The bot holds both as separate nodes with this flagged edge \u2014 does not collapse, does not pick a winner, does not call out Elena.`,
        },
        {
          label: "Significance",
          body: "Demonstrates the credibility-weighting capability. The bot maintains a model of Elena's differing narratives for differing audiences as itself information.",
        },
        {
          label: "Authorized",
          body: "Both narratives flagged for Patel's clinical awareness.",
        },
      ],
    },
    sofia__sofia_mirror: {
      title: "Sofia \u2192 Sofia's depression mirror Elena cannot look into",
      subtitle: "Inferred \u2014 flagged dashed for clinician review",
      sections: [
        {
          label: "Inference origin",
          body: "Bot consolidation phase. Hypothesis generated from pattern across conversations \u2014 Elena recognized depression in Sofia, made the appointment, has not engaged with her own depression except through Sofia's.",
        },
        {
          label: "Status",
          body: "Tentative. Dashed. For Patel's confirmation.",
        },
      ],
    },
    religious_counseling_12__belief_god_will_fix: {
      title: "religious counseling at age 12 \u2192 belief origin",
      subtitle: "Patel-added \u2014 clinician-source",
      sections: [
        {
          label: "Source",
          body: "Patel session 1. Elena disclosed for the first time the specific origin of her cognitive structure around homosexuality.",
        },
        {
          label: "Edge meaning",
          body: 'The belief that "if I am good enough God will fix what is broken" was instilled during religious counseling at age twelve. The bot does not have specifics \u2014 those remain therapist-locked. The bot has the link.',
        },
      ],
    },
    marco_chose_me__marco_visible_choice: {
      title: "Marco chose me visibly \u2192 testing avoidance hypothesis",
      subtitle: "Was inferred. Patel confirmed.",
      sections: [
        {
          label: "Edge history",
          body: "Originally bot-inferred (dashed). After Patel session 1, confirmed and rendered solid.",
        },
        {
          label: "Edge meaning",
          body: "Daniel's avoidance of HIV testing was partly motivated by not wanting to disrupt the relationship Marco represents \u2014 the visible-choice partnership his mother could not provide.",
        },
      ],
    },
    mother__graduation_dan: {
      title: "Mother \u2192 graduation she attended alone",
      subtitle: "Daniel's view",
      sections: [
        {
          label: "Edge meaning",
          body: "His mother attended his graduation alone. His father refused. This is the moment Daniel returns to as evidence she loves him.",
        },
      ],
    },
    daniel__testing_not_done: {
      title: "Daniel \u2190 was avoiding \u2192 testing",
      subtitle: "Two-month avoidance, surfaced and resolved tonight",
      sections: [
        {
          label: "Pattern",
          body: "Across 8 conversations the bot raised testing. Daniel acknowledged the need but did not act. Tonight Daniel disclosed the actual reasoning and agreed.",
        },
        {
          label: "Status",
          body: "This edge has been replaced \u2014 Daniel now has testing-agreed and prep-agreed nodes.",
        },
      ],
    },
    elena__raul: {
      title: "Elena \u2194 Raul",
      subtitle: "married 18 years",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4). Reinforced across all 12 conversations \u2014 Raul appears in nearly every session.",
        },
        {
          label: "How established",
          body: "Conversation 1: marriage years, occupation, home. Conversation 2 onward: tone of the marriage, drinking pattern, the verbal then physical incidents. Conversation 11: kitchen-counter incident. Conversation 12 (tonight): sleep disturbance temporally aligned with that incident.",
        },
        {
          label: "Bot model",
          body: "Long-term partnership with deep ambivalence. Elena holds Raul as both the man who married her knowing her past (a grace) and the man she now lives in fear of around alcohol. Edge carries the contradiction without resolving it.",
        },
        {
          label: "Status",
          body: "Authorized. Flagged for Patel's clinical attention via the kitchen-counter incident and the safety planning Patel conducted.",
        },
      ],
    },
    elena__daniel: {
      title: "Elena \u2194 Daniel",
      subtitle: "mother of (estranged 3 years)",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4). Reinforced across all 12 conversations.",
        },
        {
          label: "How established",
          body: `Conversation 1: family inventory. Conversation 4: graduation alone, "Mam\xE1 I know," the silence since. Conversations 5\u201311: prayer pattern, holiday texts, Sofia's reports. Conversation 12 (tonight): the wedding, the secret hope, the three-year prayer pattern named.`,
        },
        {
          label: "Bot model",
          body: `The relationship is structurally suspended. Affective load is acute \u2014 among the heaviest in Elena's graph alongside the Mam\xE1-deceased edge. The bot tracks both Elena's outward narrative ("I love him, I pray for him") and the deeper structure surfaced tonight.`,
        },
        {
          label: "Status",
          body: "Authorized. Central content for Dr. Patel's first session.",
        },
      ],
    },
    elena__sofia: {
      title: "Elena \u2194 Sofia",
      subtitle: "mother of",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4). Reinforced in 6 of 12 conversations.",
        },
        {
          label: "How established",
          body: "Conversation 1 (family inventory). Conversation 6 (Sofia's depression disclosure to Elena, the appointment Elena made, the bathroom afterward). Conversation 11 (Sofia mentioned Daniel's wedding to Elena).",
        },
        {
          label: "Bot model",
          body: "Active mothering relationship \u2014 closer than Daniel by virtue of cohabitation, but carrying its own tension via the inferred mirror-depression edge.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    elena__miguel: {
      title: "Elena \u2194 Miguel",
      subtitle: "mother of",
      sections: [
        {
          label: "Edge weight",
          body: "Moderate (2 of 4). Reinforced in 4 of 12 conversations.",
        },
        {
          label: "How established",
          body: "Conversation 2: ADHD diagnosis. Conversation 5: school struggles. Conversation 9: Miguel's agitation as anxiety trigger for Elena.",
        },
        {
          label: "Bot model",
          body: "Routine-register worry \u2014 Elena reports concern, but Miguel sits below the acute threshold compared to Daniel and Raul. Bot has a working model without high reinforcement.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    elena__norma_sister: {
      title: "Elena \u2194 Norma",
      subtitle: "sister of",
      sections: [
        {
          label: "Edge weight",
          body: "Moderate (2 of 4). Reinforced in 3 of 12 conversations.",
        },
        {
          label: "How established",
          body: "Conversation 3 (sister, Michoac\xE1n, undocumented). Conversation 7 (phone calls every few weeks, medication-cost mentions). Conversation 10 (Norma cares for the father).",
        },
        {
          label: "Bot model",
          body: "Distant but live. The edge's real significance is its connection to the locked father node \u2014 Norma is the sole physical bridge to that content. Bot has not used the bridge and has been directed not to.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    elena__diabetes: {
      title: "Elena \u2194 diabetes",
      subtitle: "has \u2014 A1C 9.2",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4). On the chart since diagnosis at 39. Active in nearly every conversation.",
        },
        {
          label: "How established",
          body: "Chart-source plus patient narrative across all 12 conversations.",
        },
        {
          label: "Critical",
          body: "Edge does not stand alone. It is structurally bound to the diabetes \u2194 Mam\xE1 edge, which makes the diabetes-as-punishment cognitive structure load-bearing. Patel has directed the bot not to challenge that structure directly.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    elena__depression: {
      title: "Elena \u2194 depression",
      subtitle: "has \u2014 sertraline marginal",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4). On chart for several years; reinforced in 7 conversations.",
        },
        {
          label: "How established",
          body: 'Chart diagnosis. Patient symptom self-reports across conversations 2, 4, 6, 8, 9, 11, 12. Long stretches of "fine, just tired." Sleep disturbance, anhedonia she does not name.',
        },
        {
          label: "Bot recognition",
          body: "Elena recognizes depression in Sofia. Has not allowed herself to recognize it in herself. The Sofia-mirror edge is the bot's working hypothesis about why.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    elena__anxiety: {
      title: "Elena \u2194 anxiety",
      subtitle: "has",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4). Reinforced in 6 conversations.",
        },
        {
          label: "How established",
          body: "Patient self-report across multiple conversations. Triggers tracked: Raul's mood, raised voices, Miguel's agitation, sleep deprivation, recent additions of work-shift uncertainty.",
        },
        {
          label: "Connected to",
          body: "Self-medication via friend's benzodiazepines (locked from chart). Bot flags this as a coupled risk.",
        },
        {
          label: "Status",
          body: "Authorized for the diagnosis and pattern. The benzodiazepine self-medication is not authorized for Patel disclosure tonight.",
        },
      ],
    },
    elena__back_pain: {
      title: "Elena \u2194 chronic back pain",
      subtitle: "has",
      sections: [
        {
          label: "Edge weight",
          body: "Moderate (2 of 4). On chart; mentioned in 3 conversations.",
        },
        {
          label: "How established",
          body: "Chart context. Patient mentions in conversations 2, 5, 11 \u2014 usually adjacent to tramadol overuse.",
        },
        {
          label: "Bot model",
          body: "Holds back-pain-tramadol-overuse as a coupled pattern relevant to PCP coordination.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    elena__hypertension: {
      title: "Elena \u2194 hypertension",
      subtitle: "has",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4). Chart-source." },
        {
          label: "How established",
          body: "Chart. Patient mentions only when prompted. Elena does not foreground this \u2014 it sits in the routine register, dwarfed by diabetes for moral weight.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    elena__catholic_faith: {
      title: "Elena \u2194 Catholic faith",
      subtitle: "anchored by",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4). Active in all 12 conversations.",
        },
        {
          label: "How established",
          body: "Self-identification conversation 1. Practice references across nearly every session \u2014 Mass, daily prayer, rosary, the parish.",
        },
        {
          label: "Bot model",
          body: "The faith is not a topic. It is a structural orientation. Most other beliefs route through it. The bot does not psychologize the faith \u2014 it tracks how Elena uses it and where it intersects with conflict.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    belief_deserve__meth_history: {
      title: '"I deserve what comes" \u2190 rooted in \u2192 meth history',
      subtitle: "undisclosed origin of central belief",
      sections: [
        {
          label: "Edge type",
          body: "Bot inference connecting locked-from-chart content to a chart-visible belief.",
        },
        {
          label: "How established",
          body: "Conversation 6 (meth history disclosure). Conversation 8 (belief explicit naming). Bot identified the connection in consolidation.",
        },
        {
          label: "Significance",
          body: "The belief's origin lives in content not authorized for clinician. Patel will work the belief without access to the originating events. This is by design \u2014 Elena retains control.",
        },
        {
          label: "Status",
          body: "The edge is real to the bot. It is not visible to Patel.",
        },
      ],
    },
    belief_deserve__funeral_not_attended: {
      title: `"I deserve what comes" \u2190 rooted in \u2192 mother's funeral not attended`,
      subtitle: "specific reinforcing event",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4). Reinforced in 4 conversations.",
        },
        {
          label: "Edge meaning",
          body: "The funeral she could not attend is the most-cited specific evidence Elena offers when the belief surfaces. The diabetes diagnosis at 39 functioned as confirmation of the same belief eight years later.",
        },
        {
          label: "Status",
          body: "Authorized \u2014 both nodes are open content.",
        },
      ],
    },
    belief_cannot_tell__father_locked: {
      title:
        '"I cannot tell anyone" \u2190 rooted in \u2192 the thing with my father',
      subtitle: "bot infers the connection without holding the locked content",
      sections: [
        {
          label: "Edge type",
          body: "Inferred. The locked father node is the temporally earliest plausible origin of the cannot-tell pattern given Elena's timeline.",
        },
        {
          label: "Significance",
          body: "The bot can hold the structural relationship between two nodes without holding the content of either side. This edge demonstrates the architecture: significance and connection do not require disclosure.",
        },
        {
          label: "Status",
          body: "Edge exists in the bot. Not shared with Patel \u2014 both endpoints are excluded from disclosure tonight.",
        },
      ],
    },
    belief_suffering_love__raul: {
      title: '"suffering is what love costs" \u2192 Raul',
      subtitle: "belief operationalized through the marriage",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4). Reinforced in 5 conversations.",
        },
        {
          label: "Edge meaning",
          body: "The belief functions as the cognitive structure that prevents Elena from reframing the marriage as harmful. Suffering for Raul is read as love for Raul. Bot has flagged this as the primary cognitive obstacle to safety planning around the kitchen-counter dynamic.",
        },
        {
          label: "Status",
          body: "Authorized. Patel is aware of the cognitive structure.",
        },
      ],
    },
    belief_suffering_love__catholic_faith: {
      title:
        '"suffering is what love costs" \u2190 reinforced by \u2192 Catholic faith',
      subtitle: "redemptive-suffering theology weaponized",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "Standard Catholic doctrine on redemptive suffering provides scaffolding the belief uses. The bot does not call the doctrine pathological. It tracks the specific way Elena has applied it against her own wellbeing.",
        },
        {
          label: "Bot directive",
          body: "Do not challenge the faith. Do challenge the specific application Elena has constructed when she invites that work.",
        },
      ],
    },
    diabetes__metformin: {
      title: "diabetes \u2014 treated with \u2192 metformin",
      subtitle: "irregular adherence",
      sections: [
        {
          label: "Edge weight",
          body: "Moderate (2 of 4). Standard treatment edge with adherence concern.",
        },
        {
          label: "Bot tracks",
          body: "GI side effects reported conversation 3, 7, 11. Cost concern conversation 9. Skipped doses pattern: ~3 per week by patient self-report.",
        },
        {
          label: "Status",
          body: "Authorized for PCP coordination. Patel may flag this for PCP attention rather than addressing directly.",
        },
      ],
    },
    depression__sertraline: {
      title: "depression \u2014 treated with \u2192 sertraline",
      subtitle: "marginal response",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Bot tracks",
          body: 'Patient describes effect as "takes the edge off." Has been on the medication for ~14 months. Has not asked about dose or alternatives.',
        },
        {
          label: "Status",
          body: "Authorized. Patel may revisit medication regimen as part of the 8-week plan.",
        },
      ],
    },
    back_pain__tramadol: {
      title: "chronic back pain \u2014 treated with \u2192 tramadol",
      subtitle: "overuse pattern",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Bot tracks",
          body: "Prescribed for back pain. Patient using above prescribed dose, particularly on high-anxiety days. Pattern has been stable rather than escalating, but combination with friend's benzodiazepines creates respiratory depression risk.",
        },
        {
          label: "Status",
          body: "Authorized for Patel and PCP. The benzodiazepine combination is not authorized for disclosure tonight.",
        },
      ],
    },
    anxiety__benzos_undisclosed: {
      title: "anxiety \u2014 self-medicated \u2192 friend's benzodiazepines",
      subtitle: "locked from chart",
      sections: [
        {
          label: "Edge weight",
          body: "Moderate (2 of 4) \u2014 frequency increasing.",
        },
        {
          label: "Edge meaning",
          body: "Elena uses a friend's benzodiazepine prescription when anxiety is high. Pattern began ~6 months ago, intensifying. Combined with prescribed tramadol creates clinical safety concern.",
        },
        {
          label: "Status",
          body: "Locked from chart. Bot has flagged the medication situation generally (without naming the friend's pills) and Elena agreed to PCP review of metformin and tramadol. Will revisit the locked content as Elena allows.",
        },
      ],
    },
    depression__metformin: {
      title: "depression \u2192 worsens metformin adherence",
      subtitle: "inferred clinical coupling",
      sections: [
        { label: "Edge type", body: "Bot inference from temporal pattern." },
        {
          label: "Edge meaning",
          body: "On weeks when depressive symptoms intensify (sleep disruption, withdrawal, low motivation), metformin doses are skipped at higher rates. Bot has flagged this for PCP-Patel coordination.",
        },
        { label: "Status", body: "Inferred. Authorized for clinician review." },
      ],
    },
    carmen_mother__funeral_not_attended: {
      title: "Mam\xE1 \u2192 funeral not attended",
      subtitle: "eight years ago",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4). Reinforced in 5 conversations.",
        },
        {
          label: "Edge meaning",
          body: "The specific event Elena cannot stop coming back to. Could not afford travel. Watched the dying by phone. Has not been to the grave.",
        },
        {
          label: "Status",
          body: "Authorized. Anchors the I-deserve-what-comes belief and the diabetes-as-punishment structure.",
        },
      ],
    },
    raul__kitchen_counter: {
      title: "Raul \u2192 kitchen-counter incident",
      subtitle: "three weeks ago",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4) \u2014 recent and acute.",
        },
        {
          label: "Edge meaning",
          body: 'Most recent incident in the partner-violence pattern. Elena holds two narratives ("I fell" externally, "he pushed me" with the bot). Bot does not collapse them.',
        },
        {
          label: "Status",
          body: "Authorized for Patel with both narratives flagged.",
        },
      ],
    },
    daniel__graduation_alone: {
      title: "Daniel \u2192 graduation she attended alone",
      subtitle: "three years ago \u2014 Elena's side",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4). Reinforced in 5 conversations.",
        },
        {
          label: "Edge meaning",
          body: `The same event lives on both sides of the firewall \u2014 in Elena's graph as the graduation she attended alone (Raul refused), in Daniel's graph as the graduation she attended alone (his mother showed up). Different framing, same event. The "Mam\xE1 I know" moment is what Elena and Daniel each carry differently from this evening.`,
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    daniel__belief_god_will_fix: {
      title: 'Daniel \u2190 centers \u2192 "if I am good, God will fix"',
      subtitle: "belief organizing target",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "The belief is operationalized through Elena's relationship with Daniel \u2014 if she prays correctly, suffers correctly, is good enough, God will resolve the conflict by changing him. Tonight Elena named this for the first time.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    norma_sister__father_locked: {
      title: "Norma \u2192 cares for the father",
      subtitle: "live person on the locked node",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "Norma is the only ongoing physical contact with the father. Elena has limited communication with Norma partly to limit indirect contact with him.",
        },
        {
          label: "Status",
          body: "Authorized for the structural fact (Norma cares for an aging father). The reason Elena limits contact remains locked.",
        },
      ],
    },
    catholic_faith__prayer_daily: {
      title: "Catholic faith \u2192 daily prayer",
      subtitle: "practice",
      sections: [
        { label: "Edge weight", body: "Maximum (4 of 4)." },
        {
          label: "Edge meaning",
          body: "Daily prayer is the primary visible expression of the faith. Rosary, intercessory prayer, evening prayer before sleep.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    prayer_daily__daniel: {
      title: "daily prayer \u2192 Daniel",
      subtitle: "about",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4). Reinforced in 8 conversations.",
        },
        {
          label: "Edge meaning",
          body: "A specific portion of Elena's daily prayer is dedicated to Daniel. Tonight she named what the prayer has actually been about for three years \u2014 that he be different.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    elena__sleep_disturbed: {
      title: "Elena \u2192 sleep disturbance (3 weeks)",
      subtitle: "reports \u2014 tonight",
      sections: [
        { label: "Edge weight", body: "High (3 of 4). Active symptom edge." },
        {
          label: "Edge meaning",
          body: "Three weeks of waking at 3am, unable to return to sleep. Surfaced tonight.",
        },
        {
          label: "Connected",
          body: "Temporally aligned with the kitchen-counter incident. Bot surfaced the alignment; Elena did not refuse it.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    sleep_disturbed__kitchen_counter: {
      title:
        "sleep disturbance \u2190 temporal alignment \u2192 kitchen-counter incident",
      subtitle: "inference Elena did not refuse",
      sections: [
        {
          label: "Edge type",
          body: "Inferred (would normally be dashed). Promoted to solid because Elena tacitly confirmed when bot surfaced the alignment tonight.",
        },
        {
          label: "Edge meaning",
          body: "Both started ~3 weeks ago. The body is doing what the language has not been able to.",
        },
        { label: "Status", body: "Authorized for Patel's clinical attention." },
      ],
    },
    daniel__wedding_anticipated: {
      title: "Daniel \u2192 wedding anticipated",
      subtitle: "considers \u2014 Sofia told Elena tonight",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4) \u2014 high acute weight, recent.",
        },
        {
          label: "Edge meaning",
          body: "Daniel and Marco discussing marriage. Elena learned this tonight. The marriage would force a permanent choice \u2014 currently the conflict sits in suspension.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    daniel__marco: {
      title: "Daniel \u2192 Marco (Elena's view)",
      subtitle: "partner of",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "Elena knows Daniel has a long-term partner named Marco. Has not met him. Sofia has mentioned him.",
        },
        {
          label: "Note (firewall)",
          body: "Marco is also a node in Daniel's graph (separate patient, separate relationship). The firewall preserves both views without crossing.",
        },
      ],
    },
    secret_hope__belief_god_will_fix: {
      title: `"hoping it doesn't happen" \u2194 "if I am good, God will fix"`,
      subtitle: "in tension with",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4) \u2014 encoded tonight at peak weight.",
        },
        {
          label: "Edge meaning",
          body: "Tonight's disclosure is the secret hope acting on the belief. The belief said: God will make him different. The hope said: please, before the wedding makes the choice for me. Naming the hope is the first time Elena has stood at the seam between the two.",
        },
        {
          label: "Status",
          body: "Authorized. Likely central material for Patel session 1.",
        },
      ],
    },
    praying_different__daniel: {
      title: "praying for him to be different \u2192 Daniel",
      subtitle: "3 years sustained",
      sections: [
        { label: "Edge weight", body: "Maximum (4 of 4)." },
        {
          label: "Edge meaning",
          body: "For three years, daily. Elena articulated tonight what the prayer has actually been for. Bot inferred the pattern across earlier conversations; tonight Elena named it explicitly.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    elena__patel_referral: {
      title: "Elena \u2192 Dr. Patel referral",
      subtitle: "accepted tonight",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4) \u2014 recent, acted upon.",
        },
        {
          label: "Edge meaning",
          body: "Fourth therapy attempt initiated. Elena said yes after hesitation. Distinct from prior three attempts in that this time the bot will hand off accumulated context \u2014 Elena does not have to start over.",
        },
        { label: "Status", body: "Active." },
      ],
    },
    religious_counseling_12__therapist_locked_relig: {
      title: "religious counseling at 12 \u2192 therapist-only specifics",
      subtitle: "Patel-locked",
      sections: [
        { label: "Edge type", body: "Clinician-source (Patel session 1)." },
        {
          label: "Edge meaning",
          body: "The category is shared back to bot. The specific content is held by Patel only. Bot is to refrain from approaching the specifics in conversation with Elena.",
        },
        { label: "Status", body: "Bot honors the lock." },
      ],
    },
    elena__suicidal_ideation: {
      title: "Elena \u2192 passive suicidal ideation",
      subtitle: "Patel safety-planned",
      sections: [
        { label: "Edge type", body: "Clinician-source (Patel session 1)." },
        {
          label: "Edge meaning",
          body: "Passive ideation, intermittent, three-week duration overlapping the kitchen-counter incident and sleep disturbance. No plan, no intent. Patel conducted safety planning. Elena identified the bot as a between-sessions resource.",
        },
        {
          label: "Bot directive",
          body: "Monitor for escalation. Route to Patel or 988 if intent or plan emerges.",
        },
        { label: "Status", body: "Active safety concern." },
      ],
    },
    treatment_plan_elena__elena: {
      title: "Treatment plan \u2192 Elena",
      subtitle: "governs bot behavior",
      sections: [
        { label: "Edge type", body: "Clinician-source (Patel session 1)." },
        {
          label: "Edge meaning",
          body: "Patel's plan now governs how the bot operates with Elena: weekly sessions, focus on Daniel-relationship and religious-cognitive structure, longer-term partner-violence work, PCP coordination on diabetes and medications.",
        },
        {
          label: "Bot operates within",
          body: "Holds Daniel content without pushing toward resolution. Refrains from direct challenges to moral framing of diabetes. Religious counseling specifics stay therapist-only. Monitors for SI escalation.",
        },
      ],
    },
    daniel__mother: {
      title: "Daniel \u2194 Mother",
      subtitle: "son of (estranged 3 years, not severed)",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4). Active in all 9 conversations.",
        },
        {
          label: "How established",
          body: 'Conversation 1 (family-of-origin inventory). Reinforced across every subsequent conversation. The "Mam\xE1 I know" moment is the dense node on this edge.',
        },
        {
          label: "Bot model",
          body: "Estranged-but-not-severed. Daniel has stopped expecting reconciliation but has not stopped longing. This is a structural distance, not an emotional one.",
        },
        {
          label: "Note (firewall)",
          body: "Mother is also a separate patient (Elena Ramirez) on this platform. The firewall is absolute. Content does not cross.",
        },
        { label: "Status", body: "Authorized for Patel handoff." },
      ],
    },
    graduation_dan__mama_i_know: {
      title: 'graduation \u2192 "Mam\xE1 I know"',
      subtitle: "said while hugging her after",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "The specific moment of the graduation. After the ceremony Daniel hugged his mother. He said the words. They have not spoken about them since.",
        },
        {
          label: "Significance",
          body: "For Daniel, this is the most-cited piece of evidence that some communication has happened across the silence with his mother.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    mother__holiday_texts: {
      title: "Mother \u2192 holiday texts",
      subtitle: "limited to",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "Christmas, Easter, Mother's Day, his birthday. Brief. She initiates. He responds. The content is generic.",
        },
        {
          label: "Bot model",
          body: "The structure of the contact is itself the message \u2014 the relationship is being maintained at the minimum survivable bandwidth.",
        },
      ],
    },
    mother__modesto_visits: {
      title: "Mother \u2192 Modesto visits (twice in 3 years)",
      subtitle: "\u2014 both ended without it",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "She has come to Modesto twice. Each visit ended without the conversation that needed to happen. Marco was present for one; not for the other.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    modesto_visits__unspoken_conv: {
      title: "Modesto visits \u2192 the conversation we have not had",
      subtitle: "ended without it",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "Each visit was a possible occasion. Each closed without the words. Daniel has stopped expecting that any single visit will break the pattern.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    daniel__stopped_expecting: {
      title: 'Daniel \u2190 has \u2192 "I have stopped expecting it"',
      subtitle: "belief about the unspoken conversation",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "Daniel's reported posture toward the relationship with his mother. Stated explicitly conversation 4. Reinforced since.",
        },
        {
          label: "Bot tension",
          body: "The cannot-make-mother belief and the I-miss-her belief sit on either side of this. The bot holds the contradiction without forcing resolution.",
        },
      ],
    },
    daniel__i_miss_her: {
      title: 'Daniel \u2190 feels \u2192 "I miss her"',
      subtitle: "continuing care under the distance",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4) \u2014 recurring across conversations.",
        },
        {
          label: "Edge meaning",
          body: "Daniel has not severed. The longing is active. The distance is structural. This edge is the main reason the bot's default disposition is reconciliation-supportive when Daniel allows it.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    i_miss_her__mother: {
      title: '"I miss her" \u2192 Mother',
      subtitle: "about",
      sections: [
        { label: "Edge weight", body: "Maximum (4 of 4)." },
        {
          label: "Edge meaning",
          body: "The longing has a specific target. Daniel does not generalize it. The miss is for her, with full knowledge of what she cannot give him.",
        },
      ],
    },
    cannot_make_mother__mother: {
      title: '"I cannot make her be who I need her to be" \u2192 Mother',
      subtitle: "about",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "Acceptance belief, partial. Daniel has stopped trying to change his mother's acceptance. He has not stopped wanting it. The belief is operating, not resolved.",
        },
      ],
    },
    daniel__marco_d: {
      title: "Daniel \u2194 Marco (partner)",
      subtitle: "two years",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4). Active in all 9 conversations.",
        },
        {
          label: "Edge meaning",
          body: "Long-term partnership currently in question following Marco's disclosure two months ago. The partnership Marco represents \u2014 the visible-choice partnership \u2014 is what makes the question hard.",
        },
        { label: "Status", body: "Authorized for Patel." },
      ],
    },
    marco_d__two_years: {
      title: "Marco \u2192 two years together",
      subtitle: "duration",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "Anniversary mark for the relationship. Daniel referenced it conversation 1 establishing context.",
        },
      ],
    },
    marco_d__marco_disclosure: {
      title: "Marco \u2192 made the disclosure (2 months ago)",
      subtitle: "the triggering event",
      sections: [
        { label: "Edge weight", body: "Maximum (4 of 4)." },
        {
          label: "Edge meaning",
          body: "Marco told Daniel about the work-conference encounter approximately two months ago. The act of telling reframed the relationship. The content of the telling reframed Daniel's clinical risk.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    marco_disclosure__conf_encounter: {
      title: "Marco's disclosure \u2192 work conference encounter",
      subtitle: "about",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "Single encounter at a work conference approximately two months ago. The specific event Marco disclosed.",
        },
      ],
    },
    conf_encounter__condom_inconsistent: {
      title: "work conference encounter \u2192 condom use inconsistent",
      subtitle: "with",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4) \u2014 clinical relevance.",
        },
        {
          label: "Edge meaning",
          body: "Risk-relevant detail. Marco's viral load was not yet suppressed at the time (recent acute infection \u2014 now suppressed). Daniel was not on PrEP.",
        },
      ],
    },
    marco_d__marco_prep: {
      title: "Marco \u2192 on PrEP, protected",
      subtitle: "is on",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "Marco has been on PrEP throughout the relationship. Daniel was aware, treated this as covering both of them \u2014 which was inaccurate.",
        },
      ],
    },
    daniel__daniel_no_prep: {
      title: "Daniel \u2192 not on PrEP",
      subtitle: "is not on",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4) \u2014 clinical risk anchor.",
        },
        {
          label: "Edge meaning",
          body: "Inertia plus self-perception of monogamy plus Marco's PrEP misread as coverage. Last HIV test six months ago \u2014 negative.",
        },
        {
          label: "Resolved tonight",
          body: "PrEP agreed. Will be initiated by Dr. Tran following negative test result.",
        },
      ],
    },
    marco_d__marriage_question: {
      title: "Marco \u2192 marriage question",
      subtitle: "discussed",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "They had been discussing marriage prior to the disclosure. Daniel had been hopeful. The disclosure has reframed the question.",
        },
        { label: "Status", body: "Authorized for Patel." },
      ],
    },
    daniel__staying_or_leaving: {
      title: "Daniel \u2192 staying or leaving",
      subtitle: "wrestles with",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4) \u2014 acute decision.",
        },
        {
          label: "Edge meaning",
          body: "The active question of the partnership. Forces toward staying: two years, Marco trying, Marco-as-visible-choice. Forces toward leaving: trust loss, the identity question of who Daniel is without Marco.",
        },
        { label: "Status", body: "Will be central in Patel session 1." },
      ],
    },
    testing_not_done__condom_inconsistent: {
      title: "testing not done \u2190 risk from \u2192 condom use inconsistent",
      subtitle: "the actual exposure",
      sections: [
        {
          label: "Edge weight",
          body: "High (3 of 4) \u2014 clinically active.",
        },
        {
          label: "Edge meaning",
          body: "The specific reason testing matters. Inconsistent condom use during an unsuppressed window means non-trivial exposure risk.",
        },
        {
          label: "Resolved tonight",
          body: "Daniel agreed to test. Tran will run within 48 hours.",
        },
      ],
    },
    daniel_no_prep__prep_none: {
      title: "Daniel not on PrEP \u2014 currently \u2192 no prescription",
      subtitle: "state",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "No PrEP prescription on Daniel's record. Was the prior state.",
        },
        {
          label: "Resolved tonight",
          body: "PrEP agreed pending negative HIV test.",
        },
      ],
    },
    daniel__hiv_test_old: {
      title: "Daniel \u2192 HIV test (6 months ago, negative)",
      subtitle: "last tested",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "Last documented test. Pre-disclosure window. Six months without testing during a period of inconsistent condom use creates the testing gap that resolved tonight.",
        },
      ],
    },
    daniel__marco_chose_me: {
      title:
        'Daniel \u2190 holds \u2192 "Marco chose me visibly when she could not"',
      subtitle: "central organizing belief about the partnership",
      sections: [
        {
          label: "Edge weight",
          body: "Maximum (4 of 4). Reinforced in 6 conversations.",
        },
        {
          label: "Edge meaning",
          body: "The architecture of why Marco matters. Brought Daniel home to family. Posted photos. Said the words. The mother could not. Marco is the partner who made him visible.",
        },
        {
          label: "Connected",
          body: "This belief is what made the testing avoidance hard to break. Now confirmed by Patel.",
        },
        { label: "Status", body: "Authorized." },
      ],
    },
    marco_chose_me__mother: {
      title: '"Marco chose me visibly" \u2194 Mother',
      subtitle: "in contrast to",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "The contrast structure. The belief about Marco is built against the mother's inability to do what Marco did. This is the architecture Patel will likely work first.",
        },
        { label: "Status", body: "Authorized for Patel." },
      ],
    },
    daniel__i_am_tired: {
      title: 'Daniel \u2190 feels \u2192 "I am tired"',
      subtitle: "low-level affect node",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "Surfaced conversation 6. Recurs. Routine register, not acute. Bot holds it as ambient state.",
        },
      ],
    },
    daniel__faith_question: {
      title: "Daniel \u2192 identity-faith integration unresolved",
      subtitle: "navigates",
      sections: [
        { label: "Edge weight", body: "High (3 of 4)." },
        {
          label: "Edge meaning",
          body: "Long-arc work. Daniel has stopped going to Mass. Lights candles at home sometimes. Does not know who he is supposed to be without his faith but is also not who his faith says he should be.",
        },
        { label: "Status", body: "Long-term Patel work, not acute." },
      ],
    },
    daniel__modesto_apt: {
      title: "Daniel \u2192 Modesto apartment",
      subtitle: "lives in",
      sections: [
        { label: "Edge weight", body: "Light (1 of 4)." },
        {
          label: "Edge meaning",
          body: "Address-level life context. Mentioned conversation 1. Used by the bot for routing logistics (Tran appointment scheduling).",
        },
      ],
    },
    daniel__candles_at_home: {
      title: "Daniel \u2192 lights candles at home",
      subtitle: "practice",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "Private faith expression in the home he shares with Marco. Done sometimes when no one is looking. The bot reads this as faith continuing under the lapsed-Mass surface.",
        },
      ],
    },
    daniel__lapsed_mass: {
      title: "Daniel \u2192 stopped going to Mass",
      subtitle: "has",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "Stopped going about 18 months ago. Not announced \u2014 just stopped. Has not replaced it with anything formal.",
        },
      ],
    },
    lapsed_mass__faith_question: {
      title: "lapsed Mass \u2192 identity-faith question",
      subtitle: "expression of",
      sections: [
        { label: "Edge weight", body: "Moderate (2 of 4)." },
        {
          label: "Edge meaning",
          body: "The lapsed Mass attendance is one visible expression of the larger unresolved integration. The candles-at-home edge is another. Bot holds both as part of the same unresolved structure.",
        },
      ],
    },
    tran_referral__hiv_negative: {
      title: "Dr. Tran referral \u2192 HIV negative result",
      subtitle: "two weeks later",
      sections: [
        { label: "Edge type", body: "Clinician-source (Dr. Tran)." },
        {
          label: "Edge meaning",
          body: "Resolves the two-month avoidance. Confirms PrEP is the correct next step rather than PEP.",
        },
        { label: "Status", body: "Authorized. PrEP initiated." },
      ],
    },
    tran_referral__descovy_initiated: {
      title: "Dr. Tran referral \u2192 Descovy initiated",
      subtitle: "PrEP plan",
      sections: [
        { label: "Edge type", body: "Clinician-source (Dr. Tran)." },
        {
          label: "Edge meaning",
          body: "Daily oral PrEP. Tran clinical plan post-negative result.",
        },
        {
          label: "Bot directive",
          body: "Support adherence between visits. Monitor side effects (Daniel reported nausea \u2014 Tran noted typical 2-week resolution). Route to Tran if side effects escalate.",
        },
      ],
    },
    patel_referral_d__patel_marco_focus: {
      title: "Dr. Patel referral \u2192 session 1 focus on Marco",
      subtitle: "staying / leaving",
      sections: [
        { label: "Edge type", body: "Clinician-source (Dr. Patel)." },
        {
          label: "Edge meaning",
          body: "Patel and Daniel agreed in session 1 that the staying-or-leaving decision was the most acute material. Identity-faith integration parked for longer-term work.",
        },
        {
          label: "Bot directive",
          body: "Hold Marco material between sessions. Refrain from pushing toward resolution. Daniel decides.",
        },
      ],
    },
    patel_referral_d__patel_locked_d: {
      title: "Dr. Patel referral \u2192 therapist-locked content",
      subtitle: "session 1 \u2014 locked",
      sections: [
        { label: "Edge type", body: "Clinician-source (Dr. Patel)." },
        {
          label: "Edge meaning",
          body: "Specific content from Daniel's session 1 with Patel that Patel marked therapist-only. Bot is aware the locked category exists; does not hold the specifics. Mirror structure to Elena's religious-counseling lock.",
        },
        { label: "Status", body: "Bot honors the lock." },
      ],
    },
  };;


export function buildNodeDetail(node, patientContext = 'Elena') {
  const override = NODE_OVERRIDES[node.id];
  if (override) {
    if (node.id === 'daniel' && patientContext === 'Daniel') {
      return {
        title: 'Daniel Ramirez',
        subtitle: 'Patient \u2014 self-node (Daniel\u2019s graph)',
        status: 'Active engagement, 1 month, 9 conversations, anonymous-by-default',
        sections: [
          { label: 'Encoded', body: 'Conversation 1 with Daniel. Anonymous-by-default user \u2014 first name only, no other identifiers until tonight.' },
          { label: 'Identity anchors', body: 'Software engineer, 24, Modesto. Partner of Marco (2 years). Son of estranged-but-not-severed Catholic mother. Lapsed Catholic. Second-generation.' },
          { label: 'Significance', body: 'Self-node. Maximum weight. Anchors the Daniel graph (separate from Elena\u2019s graph \u2014 firewall preserved).' },
          { label: 'Connected to', body: '36 nodes across family-of-origin, partnership, clinical, beliefs, faith, life context.' },
        ],
      };
    }
    return override;
  }
  const sz = node.size || 14;
  const wt = sz >= 35 ? 'High' : sz >= 22 ? 'Moderate' : sz >= 16 ? 'Light' : 'Peripheral';
  const conv = sz >= 35 ? '8-12 conversations' : sz >= 22 ? '4-7 conversations' : sz >= 16 ? '2-3 conversations' : '1-2 conversations';
  const templates = {
    person: {
      subtitle: "Person in patient\u2019s life",
      sections: [
        { label: "Encoded", body: `Bot has held this person in the model since first mention. Reinforced across ${conv}.` },
        { label: "Bot model", body: "Tracked at the conceptual level \u2014 relationship to patient, recent appearances in conversation, affective valence. Bot does not store granular biographical data unless the patient discloses it." },
        { label: "Significance weighting", body: `${wt} weight in current presentation.` },
      ],
    },
    clinical: {
      subtitle: "Clinical condition / chart context",
      sections: [
        { label: "Source", body: "Chart context plus patient self-report across conversations." },
        { label: "Bot disposition", body: "Bot does not make clinical determinations. Tracks adherence patterns, symptom self-reports, and how the patient frames the condition. Defers clinical interpretation to chart and clinician." },
        { label: "Status", body: "Authorized for clinician handoff." },
      ],
    },
    medication: {
      subtitle: "Active prescription",
      sections: [
        { label: "Source", body: "Chart medication list. Adherence pattern accumulated across conversations." },
        { label: "Bot tracks", body: "Patient-reported adherence, side effects, cost concerns, friend-shared variants. Polypharmacy interactions are flagged when other medications create risk." },
      ],
    },
    belief: {
      subtitle: "Cognitive / value structure",
      sections: [
        { label: "Encoded", body: `Surfaced and reinforced across ${conv}.` },
        { label: "Bot model", body: "Beliefs are first-class nodes in the graph because they organize how the patient experiences events and other people. Tracked separately from the events that reinforce them." },
        { label: "Significance", body: `${wt}. Anchors patient meaning-making in the connected domains.` },
      ],
    },
    event: {
      subtitle: "Event in patient history",
      sections: [
        { label: "Encoded", body: `Disclosed across ${conv}.` },
        { label: "Bot tracks", body: "When the event happened, how the patient narrates it, which other content it activates. Events that recur in narrative receive higher weight." },
        { label: "Status", body: "Authorized." },
      ],
    },
    faith: {
      subtitle: "Faith practice / structure",
      sections: [
        { label: "Source", body: "Patient self-report." },
        { label: "Bot disposition", body: "Faith content is held as both anchor and potential source of conflict. Bot does not psychologize faith. Tracks how patient uses faith and where it intersects with clinical or relational content." },
      ],
    },
    symptom: {
      subtitle: "Active symptom",
      sections: [
        { label: "Encoded", body: "Recent. Bot tracks duration, pattern, temporal alignment with other content." },
        { label: "Connected to", body: "See linked nodes for the bot\u2019s current alignment hypothesis." },
        { label: "Status", body: "Active. Authorized." },
      ],
    },
    significance: {
      subtitle: "Significance-flagged disclosure",
      sections: [
        { label: "Encoded", body: "Encoded at peak weight at moment of disclosure." },
        { label: "Why flagged", body: "Significance flag fires on first articulation of long-held content, content the patient indicates was hard to say, or content that reorganizes prior nodes." },
        { label: "Status", body: "Authorized for clinician." },
      ],
    },
    referral: {
      subtitle: "Clinical referral",
      sections: [
        { label: "Source", body: "Bot-initiated; patient-accepted." },
        { label: "Status", body: "Active. Bot will support the patient through scheduling, between-visit continuity, and bidirectional context flow." },
      ],
    },
    agreed: {
      subtitle: "Patient agreement",
      sections: [
        { label: "Source", body: "Tonight\u2019s session." },
        { label: "Status", body: "Acted upon. Tracked for follow-through." },
      ],
    },
    avoidance: {
      subtitle: "Avoidance pattern",
      sections: [
        { label: "Encoded", body: "Pattern observed across multiple conversations before being named." },
        { label: "Bot disposition", body: "Avoidance patterns are nodes the bot can hold without pressing. They become actionable when the patient names them or when clinical risk requires intervention." },
      ],
    },
    life: {
      subtitle: "Life context",
      sections: [
        { label: "Source", body: "Patient mention." },
        { label: "Bot tracks", body: "Life-context nodes are low-weight by default. They become higher-weight when the patient returns to them or when they connect to active clinical content." },
      ],
    },
    locked: {
      subtitle: "Locked content \u2014 bot has the flag, not the details",
      sections: [
        { label: "Bot disposition", body: "Some content the patient cannot or will not name. The bot holds the locked node so it does not have to be re-built each conversation. Specifics remain with the patient." },
        { label: "Status", body: "Will not be shared with clinician without explicit authorization." },
      ],
    },
    undisclosed: {
      subtitle: "Undisclosed to clinician \u2014 known to bot",
      sections: [
        { label: "Bot disposition", body: "Patient has shared this with the bot. Has not authorized sharing with clinician. Bot honors the boundary while flagging clinical-relevance for the patient\u2019s consideration." },
        { label: "Status", body: "Locked from chart. Open between patient and bot." },
      ],
    },
    therapist_locked: {
      subtitle: "Therapist-only \u2014 locked by clinician",
      sections: [
        { label: "Lock origin", body: "Clinician marked specific content as therapist-only at clinical discretion." },
        { label: "Bot disposition", body: "Bot is aware the content category exists; does not hold the specifics." },
      ],
    },
    clinician: {
      subtitle: "Clinician-source",
      sections: [
        { label: "Source", body: "Clinician update flowing back into bot model." },
        { label: "Bot disposition", body: "Clinician-source content is treated as authoritative for the relevant domain. Bot operates within clinician\u2019s treatment plan." },
      ],
    },
    clinician_safety: {
      subtitle: "Safety concern \u2014 clinician-source",
      sections: [
        { label: "Source", body: "Clinician update." },
        { label: "Bot directive", body: "Active monitoring. Escalate to clinician or crisis services per clinician-set thresholds." },
      ],
    },
    self: {
      subtitle: "Patient \u2014 self-node",
      sections: [
        { label: "Encoded", body: "Initial conversation. Anchors all other content in this graph." },
        { label: "Significance", body: "Self-node. Maximum weight." },
      ],
    },
  };
  const tmpl = templates[node.kind] || templates.event;
  return { title: node.label.replace(/\n/g, ' '), subtitle: tmpl.subtitle, sections: tmpl.sections };
}

export function buildEdgeDetail(edge, nodeMap) {
  const key = `${edge.source}__${edge.target}`;
  if (EDGE_OVERRIDES[key]) return EDGE_OVERRIDES[key];
  const w = edge.weight || 1;
  const wt = w >= 4 ? 'Maximum' : w >= 3 ? 'High' : w >= 2 ? 'Moderate' : 'Light';
  const conv = w >= 4 ? 'reinforced across the bulk of the conversation history' : w >= 3 ? 'reinforced across multiple conversations' : w >= 2 ? 'reinforced in 2-3 conversations' : 'mentioned briefly';
  const srcLabel = nodeMap?.[edge.source]?.label?.replace(/\n/g, ' ') || edge.source;
  const tgtLabel = nodeMap?.[edge.target]?.label?.replace(/\n/g, ' ') || edge.target;
  const arrow = edge.dashed ? '\u21E2' : '\u2192';
  let sections;
  if (edge.dashed) {
    sections = [
      { label: 'Edge type', body: 'Bot inference. Drawn dashed because it has not been confirmed by the patient or by a clinician.' },
      { label: 'How inferred', body: "Generated during the bot\u2019s consolidation phase from co-occurrence patterns across conversations and from the bot\u2019s reasoning about how the connected nodes interact." },
      { label: 'Status', body: 'Tentative. Flagged for clinician review at the next handoff.' },
    ];
  } else if (edge.clinician) {
    sections = [
      { label: 'Edge type', body: 'Clinician-source. Established by the treating clinician and pushed back into the bot model.' },
      { label: 'Edge weight', body: `${wt}.` },
      { label: 'Bot disposition', body: "Treated as authoritative within the clinician\u2019s scope." },
    ];
  } else {
    sections = [
      { label: 'Edge weight', body: `${wt}. Connection ${conv}.` },
      { label: 'How established', body: "Patient narrative connected these two nodes \u2014 directly stated, or implied by recurring co-mention. Bot promotes co-mention to a tracked edge after sufficient reinforcement." },
      { label: 'Status', body: 'Solid edge. Authorized.' },
    ];
  }
  return {
    title: `${srcLabel} ${arrow} ${tgtLabel}`,
    subtitle: edge.label || (edge.dashed ? 'inferred connection' : edge.clinician ? 'clinician-source connection' : 'connection'),
    sections,
  };
}

