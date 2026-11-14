// The demo video, scene by scene. `say` is the voiceover; `callout` is a big on-screen number.
// `pre` is silence (s) before the voice starts; `post` is breathing time after it.
export const VOICE_ID = 'Xb7hH8MSUJpSbSDYk0k2'; // Alice — British, clear, engaging educator

export const SCENES = [
  { id: 's0', title: 'Do two patients with the same cancer have an equal chance?', say: '', pre: 0, post: 4.2 },
  {
    id: 's1',
    say: 'Two people in Finland get the same lung cancer. In our model, one starts treatment in three months. The other waits seven and a half.',
    pre: 0.4,
    post: 0.8,
  },
  {
    id: 's2',
    say: "This is Polku, an AI analyst for Finland's wellbeing counties. Early national data suggest patients wait about five months from first symptom to treatment. In Denmark, just over two.",
    pre: 0.5,
    post: 0.6,
    callout: { text: '154 vs 67 days', sub: 'Finland vs Denmark · preliminary', at: 0.62 },
  },
  {
    id: 's3',
    say: 'But averages hide people. Patient A uses work health care near Oulu. Patient B is retired, lives alone, 180 kilometres from hospital in Lapland. Patient B waits 131 days longer.',
    pre: 0.6,
    post: 0.8,
    callout: { text: '+131 days', sub: 'same cancer, different chance', at: 0.86 },
  },
  {
    id: 's4',
    say: 'And most of that gap opens before a specialist ever sees them.',
    pre: 0.4,
    post: 1.4,
    callout: { text: '70%', sub: 'of the gap opens before the specialist', at: 0.35 },
  },
  {
    id: 's5',
    say: "It's about access, not biology. Give Patient B the same fast lane as work health care, and they gain almost three months. Help them through the system, and Lapland turns greener.",
    pre: 0.4,
    post: 0.8,
  },
  {
    id: 's6',
    say: 'Gemini read the full national cancer strategy, its roadmap and the evidence, and estimated what every action would change. Polku then tested every combination, and recommends three for Lapland, each tied to the roadmap.',
    pre: 0.4,
    post: 0.6,
    callout: { text: '512 combinations', sub: 'tested by the simulator', at: 0.66 },
  },
  {
    id: 's7',
    say: "Planners can bring their own ideas. Gemini estimates the effect, the simulator computes the days. And it's honest: a monthly mobile CT unit would barely help, and it cites a Danish trial to say why.",
    pre: 0.4,
    post: 1.0,
  },
  {
    id: 's8',
    say: "Every number has a source. Even with very cautious assumptions, Patient B still waits 63 days longer. Finland doesn't systematically measure this yet, so the next step is a pilot with one wellbeing county.",
    pre: 0.4,
    post: 0.6,
    callout: { text: 'Still +63 days', sub: 'with very cautious assumptions', at: 0.36 },
  },
  { id: 's9', say: 'Polku. One path, equal for everyone.', pre: 0.6, post: 2.6 },
];
