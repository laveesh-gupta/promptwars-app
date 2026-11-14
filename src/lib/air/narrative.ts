import { fingerprint } from './normalize';
import type { Action, Context, Metric, Narrative } from './types';

export function actionId(action: Pick<Action, 'title' | 'owner' | 'location'>) {
  return `action-${fingerprint([action.title, action.owner, action.location || ''].join('|').toLowerCase())}`;
}
export function sampleNarrative(context: Context, metrics: Metric[]): Narrative {
  const target =
    context.role === 'School'
      ? metrics.find((m) => /school/i.test(m.site))
      : context.role === 'Housing society'
        ? metrics.find((m) => /society/i.test(m.site))
        : metrics[0];
  const evidence = target ? [target.id] : [];
  const roleActions =
    context.role === 'School'
      ? [
          [
            'Review pupil arrival at the gate',
            'School administrator',
            'School gate',
            'Children use this confirmed sample site. The school can review its own gate arrangements; the readings do not identify a pollution source.',
            'Observe arrival arrangements and repeat readings at the same times.',
            'Before next school day',
            'Refer surrounding-road issues to the ward team.',
          ],
          [
            'Review outdoor activity locations',
            'Activity coordinator',
            'School grounds',
            'Use verified local public-health guidance before deciding activity timing and location.',
            'Check the current local advisory; record the decision for caregivers.',
            'Daily review',
            'Seek qualified local advice for health-specific concerns.',
          ],
        ]
      : context.role === 'Housing society'
        ? [
            [
              'Inspect entrance and onsite practices',
              'Society facilities lead',
              'Society entrance',
              'The entrance is within the society’s remit. Check onsite dust and waste practices without blaming an unverified source.',
              'Record entrance conditions and repeat paired readings at matched times.',
              'Within two days',
              'Refer offsite conditions to the ward team.',
            ],
            [
              'Check the monitoring gap',
              'Society committee',
              'Society entrance',
              'Missing readings cannot be interpreted as cleaner air. Confirm the sensor is working before discussing a trend.',
              'Check power and sensor status; collect the missing time slot.',
              'Next reporting period',
              'Ask the monitoring team for technical support.',
            ],
          ]
        : [
            [
              'Inspect the leading observed location',
              'Ward environment officer',
              target?.site || 'Monitoring network',
              'Highest observation mean within the supplied comparable group. Inspection can verify local conditions; it cannot be replaced by a source assumption.',
              'Record visible conditions and repeat matched readings; keep possible explanations separate from observations.',
              'Within one day',
              'Refer specialist transport or enforcement issues to the relevant team.',
            ],
            [
              'Restore complete local monitoring',
              'Monitoring team',
              'Society entrance',
              'Unequal coverage limits what can be concluded about this site. Monitoring repair is a decision, not an inferred pollution trend.',
              'Verify power and placement, then collect matched morning readings.',
              'Next reporting period',
              'Escalate equipment faults to the sensor operator.',
            ],
          ];
  const actions: Action[] = roleActions.map((a, i) => {
    const item = {
      title: a[0],
      owner: a[1],
      location: a[2],
      rationale: a[3],
      verification: a[4],
      horizon: a[5],
      escalation: a[6],
      evidence: i === 0 ? evidence : [],
      basis: i === 0 ? ('Observation' as const) : ('Guidance' as const),
    };
    return { ...item, id: actionId(item) };
  });
  const site = target?.site || 'the monitoring network';
  const token = target ? `{{${target.id}.mean}} µg/m³` : 'not available';
  const internal = `Situation\n${context.locality}. ${context.role} review. The observation mean at ${site} is ${token}. These are spot observations, not a regulatory daily average.\n\nDecision\n${actions[0].title}. Owner: ${actions[0].owner}. ${actions[0].rationale}\n\nUncertainty and change\n${target?.delta !== null && target?.delta !== undefined ? `Matched change: {{${target.id}.delta}} µg/m³. This does not prove an action caused the change.` : 'No compatible change is established for this site.'} Expected coverage is unknown. Check missing readings before concluding a trend.\n\nNext review\n${actions[0].verification} ${actions[0].horizon}.`;
  const citizen =
    context.level === 'Simple'
      ? `Local update\nReadings at ${site} need follow-up. The observation mean is ${token}. We do not yet know the source. This is not an official AQI.\n\nWhat you can do\nFollow local public-health advice. Choose less polluted places and times for outdoor activity where possible. Take extra care for children, older adults and people with heart or lung conditions.\n\nWhat happens next\n${actions[0].owner} will review local conditions. Missing readings must be checked. A change in readings does not prove the action caused it.`
      : `Local evidence and limitations\nThe supplied spot observations at ${site} have a mean of ${token}. Coverage is not established and source attribution is unverified; these observations do not define an official AQI or health category.\n\nPractical precautions\nWHO guidance supports considering less polluted times and places for outdoor activity. Children, older adults and people with heart or lung conditions may need additional precautions; follow local public-health advice.\n\nFollow-through\n${actions[0].owner}: ${actions[0].title}. Repeat comparable monitoring and review missing observations before drawing a trend or causal conclusion.`;
  const translated =
    context.level === 'Simple'
      ? `स्थानीय जानकारी\n${site} पर लिए गए मापों की जाँच ज़रूरी है। मापों का औसत ${token} है। प्रदूषण का स्रोत अभी पता नहीं है। यह आधिकारिक AQI नहीं है।\n\nआप क्या कर सकते हैं\nस्थानीय स्वास्थ्य सलाह मानें। जहाँ संभव हो, बाहर की गतिविधियों के लिए कम प्रदूषण वाले समय और स्थान चुनें। बच्चों, बुज़ुर्गों और हृदय या फेफड़ों की बीमारी वाले लोगों का विशेष ध्यान रखें।\n\nअगला कदम\nजिम्मेदार टीम स्थानीय स्थितियों और अधूरे मापों की जाँच करेगी। मापों में बदलाव से यह साबित नहीं होता कि कार्रवाई के कारण ही बदलाव आया।`
      : `स्थानीय साक्ष्य और सीमाएँ\n${site} पर उपलब्ध सीमित मापों का औसत ${token} है। मापों की पूर्णता और प्रदूषण के स्रोत की पुष्टि नहीं हुई है। यह आधिकारिक AQI या स्वास्थ्य जोखिम का वर्गीकरण नहीं है।\n\nव्यावहारिक सावधानियाँ\nWHO के मार्गदर्शन के अनुसार, जहाँ संभव हो बाहर की गतिविधियों का समय और स्थान बदलकर प्रदूषण से संपर्क कम करने पर विचार करें। बच्चों, बुज़ुर्गों तथा हृदय या फेफड़ों की बीमारी वाले लोगों के लिए स्थानीय स्वास्थ्य सलाह का विशेष ध्यान रखें।\n\nआगे की जाँच\nजिम्मेदार टीम स्थानीय परिस्थितियों का निरीक्षण करेगी। रुझान समझने से पहले समान समय पर दोबारा माप लें और अधूरे मापों की जाँच करें। केवल मापों से किसी कार्रवाई का कारणात्मक प्रभाव सिद्ध नहीं होता।`;
  return {
    summary: `${context.role === 'Ward officer' ? 'Start the local inspection at' : 'Focus your team’s next check on'} ${site}. Keep the evidence with the decision.`,
    findings: target
      ? [
          {
            title: 'A local decision grounded in supplied readings',
            detail: `${site}: observation mean ${token}.`,
            limitation:
              'Source unverified. Expected coverage unknown. Compare only matched reporting windows.',
            evidence,
            assertion: 'observation',
          },
        ]
      : [],
    actions,
    internal,
    citizen,
    translated,
    internalTranslated: `${context.level === 'Standard' ? 'आंतरिक कार्य-समीक्षा — उपलब्ध मापों, अनिश्चितताओं और जिम्मेदारियों का रिकॉर्ड।\n\n' : ''}स्थिति\n${context.locality}। ${site} पर उपलब्ध मापों का औसत ${token} है। ये सीमित समय पर लिए गए माप हैं, पूरे दिन का नियामक औसत नहीं।\n\nकार्रवाई और जिम्मेदारी\nकार्य: ${actions[0].title}। स्थानीय स्थितियों का निरीक्षण और समान समय पर दोबारा मापन करें। जिम्मेदार भूमिका: ${actions[0].owner}।\n\nअनिश्चितता\n${target && target.delta !== null ? `तुलनीय मापों में बदलाव: {{${target.id}.delta}} µg/m³। ` : 'इस स्थान के लिए तुलनीय बदलाव स्थापित नहीं है। '}प्रदूषण का स्रोत प्रमाणित नहीं है। अधूरे मापों की जाँच करें। केवल दो अवधियों के मापों से कार्रवाई का प्रभाव सिद्ध नहीं होता।\n\nअगली समीक्षा\nटीम कार्रवाई की स्थिति और निगरानी से जुड़े नोट दर्ज करे। अगली रिपोर्टिंग अवधि में साक्ष्य और अधूरे मापों की फिर से समीक्षा करें।`,
  };
}
