export interface FacilityDef {
  code: string;
  icon: string;
  i18nKey: string;
}

export const MUSLIM_FACILITIES: FacilityDef[] = [
  { code: 'halal_certified', icon: '📜', i18nKey: 'facilityReview.facilities.halalCertified' },
  { code: 'prayer_room',   icon: '🕌', i18nKey: 'facilityReview.facilities.prayerRoom' },
  { code: 'wudu',          icon: '💧', i18nKey: 'facilityReview.facilities.wudu' },
  { code: 'bidet',         icon: '🚿', i18nKey: 'facilityReview.facilities.bidet' },
  { code: 'space_to_pray', icon: '🧎', i18nKey: 'facilityReview.facilities.spaceToPray' },
  { code: 'pork_free',     icon: '🚫🐷', i18nKey: 'facilityReview.facilities.porkFree' },
  { code: 'cash_only',     icon: '💵', i18nKey: 'facilityReview.facilities.cashOnly' },
  { code: 'halal_food',    icon: '🍽️', i18nKey: 'facilityReview.facilities.halalFood' },
  { code: 'vegan_option',  icon: '🌱', i18nKey: 'facilityReview.facilities.veganOption' },
  { code: 'muslim_owned',  icon: '👤', i18nKey: 'facilityReview.facilities.muslimOwned' },
  { code: 'muslim_staff',  icon: '👥', i18nKey: 'facilityReview.facilities.muslimStaff' },
  { code: 'alcohol_free',  icon: '🚫🍺', i18nKey: 'facilityReview.facilities.alcoholFree' },
  { code: 'free_wifi',     icon: '📶', i18nKey: 'facilityReview.facilities.freeWifi' },
  { code: 'qibla_direction', icon: '🧭', i18nKey: 'facilityReview.facilities.qiblaDirection' },
]
