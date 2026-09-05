export const en = {
  'risk.Low.title': 'CLEAR',
  'risk.Medium.title': 'BE CAREFUL',
  'risk.High.title': 'HIGH RISK — SLOW DOWN',
  'risk.Unknown.title': "CAN'T CHECK",

  'reason.blackspot': 'Crash blackspot nearby',
  'reason.overLimit': 'Over the speed limit',
  'reason.phone': 'Phone use while riding',
  'reason.alcohol': 'Alcohol',
  'reason.noHelmet': 'No helmet',
  'reason.smoking': 'Smoking while riding',

  'watch.rain': 'Rain',
  'watch.fog': 'Fog',
  'watch.wet': 'Wet road',
  'watch.night': 'Riding at night',

  'label.why': 'Why this reading',
  'label.watchOut': 'Also watch out for',
  'label.startRide': 'Start ride',
  'label.stopRide': 'Stop ride',
  'label.language': 'Language',
  'label.sample': 'Sample reading — not the real model',
  'label.unknownHelp': 'Cannot reach RideGuard right now',
  'label.checking': 'Checking…',
} as const;

/** Every translatable string in the app is one of these. */
export type MessageKey = keyof typeof en;
