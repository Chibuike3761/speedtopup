/**
 * Mirrors SERVICE_CONFIG in js/services.js so the WhatsApp bot offers the
 * same categories/networks as the website. Kept as a separate server-side
 * copy (rather than shared) because WhatsApp list messages cap out at 10
 * rows total, so this trims a couple of the longer lists slightly.
 */
const CATALOG = {
  airtime: {
    label: 'Airtime',
    needsVariation: false,
    billersLabel: 'phone number to recharge',
    billersIsPhone: true,
    networks: [
      { value: 'mtn', label: 'MTN' },
      { value: 'glo', label: 'Glo' },
      { value: 'airtel', label: 'Airtel' },
      { value: 'etisalat', label: '9mobile' }
    ]
  },
  data: {
    label: 'Data',
    needsVariation: true,
    billersLabel: 'phone number to recharge',
    billersIsPhone: true,
    networks: [
      { value: 'mtn-data', label: 'MTN' },
      { value: 'glo-data', label: 'Glo' },
      { value: 'airtel-data', label: 'Airtel' },
      { value: 'etisalat-data', label: '9mobile' }
    ]
  },
  tv: {
    label: 'TV Subscription',
    needsVariation: true,
    billersLabel: 'smartcard/IUC number',
    billersIsPhone: false,
    networks: [
      { value: 'dstv', label: 'DSTV' },
      { value: 'gotv', label: 'GOTV' },
      { value: 'startimes', label: 'StarTimes' }
    ]
  },
  electricity: {
    label: 'Electricity',
    needsVariation: true,
    billersLabel: 'meter number',
    billersIsPhone: false,
    variationOptions: [
      { value: 'prepaid', label: 'Prepaid' },
      { value: 'postpaid', label: 'Postpaid' }
    ],
    networks: [
      { value: 'ikeja-electric', label: 'Ikeja Electric' },
      { value: 'eko-electric', label: 'Eko Electric' },
      { value: 'abuja-electric', label: 'Abuja Electric' },
      { value: 'kano-electric', label: 'Kano Electric' },
      { value: 'portharcourt-electric', label: 'PH Electric' },
      { value: 'ibadan-electric', label: 'Ibadan Electric' },
      { value: 'jos-electric', label: 'Jos Electric' },
      { value: 'kaduna-electric', label: 'Kaduna Electric' },
      { value: 'enugu-electric', label: 'Enugu Electric' },
      { value: 'benin-electric', label: 'Benin Electric' }
    ]
  }
};

module.exports = CATALOG;
