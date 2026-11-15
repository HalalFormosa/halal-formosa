export interface FacilityDef {
  code: string;
  icon: string;
  i18nKey: string;
  /** Lower = more relevant to a Muslim visitor's core needs (prayer, halal food). Used to pick which badges show first when collapsed. */
  priority: number;
}

export const MUSLIM_FACILITIES: FacilityDef[] = [
  { code: 'halal_certified', icon: '📜', i18nKey: 'facilityReview.facilities.halalCertified', priority: 1 },
  { code: 'halal_food',    icon: '🍽️', i18nKey: 'facilityReview.facilities.halalFood', priority: 2 },
  { code: 'prayer_room',   icon: '🕌', i18nKey: 'facilityReview.facilities.prayerRoom', priority: 3 },
  { code: 'wudu',          icon: '💧', i18nKey: 'facilityReview.facilities.wudu', priority: 4 },
  { code: 'pork_free',     icon: '🚫🐷', i18nKey: 'facilityReview.facilities.porkFree', priority: 5 },
  { code: 'muslim_owned',  icon: '👤', i18nKey: 'facilityReview.facilities.muslimOwned', priority: 6 },
  { code: 'alcohol_free',  icon: '🚫🍺', i18nKey: 'facilityReview.facilities.alcoholFree', priority: 7 },
  { code: 'muslim_staff',  icon: '👥', i18nKey: 'facilityReview.facilities.muslimStaff', priority: 8 },
  { code: 'space_to_pray', icon: '🧎', i18nKey: 'facilityReview.facilities.spaceToPray', priority: 9 },
  { code: 'vegan_option',  icon: '🌱', i18nKey: 'facilityReview.facilities.veganOption', priority: 10 },
  { code: 'bidet',         icon: '🚿', i18nKey: 'facilityReview.facilities.bidet', priority: 11 },
  { code: 'cash_only',     icon: '💵', i18nKey: 'facilityReview.facilities.cashOnly', priority: 12 },
  { code: 'qibla_direction', icon: '🧭', i18nKey: 'facilityReview.facilities.qiblaDirection', priority: 13 },
  { code: 'free_wifi',     icon: '📶', i18nKey: 'facilityReview.facilities.freeWifi', priority: 14 },
]
