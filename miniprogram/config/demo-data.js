const BRAND = {
  name: '鱼水和 AI 物业助手',
  greeting: '今天想办理什么？',
  subtitle: '告诉我您的需求，我来帮您办理',
};

// 以下房屋、人员与账单均为纯演示数据，不对应任何真实住户或物业记录。
const CURRENT_HOUSE = {
  id: 'house-demo-001',
  community: '示范社区',
  address: '演示房屋101',
  ownerName: '演示用户',
};

const QUICK_INTENTS = [
  {
    id: 'arrears',
    title: '查欠费',
    subtitle: '账单明细',
    prompt: '帮我查一下物业欠费',
    icon: '/assets/icons/fee.svg',
    tone: 'orange',
  },
  {
    id: 'renovation-progress',
    title: '装修进度',
    subtitle: '实时查看',
    prompt: '帮我看看装修办理进度',
    icon: '/assets/icons/renovation.svg',
    tone: 'green',
  },
  {
    id: 'delivery-ready',
    title: '交房准备',
    subtitle: '清单提醒',
    prompt: '交房前需要准备什么',
    icon: '/assets/icons/delivery.svg',
    tone: 'coral',
  },
];

const SERVICE_GROUPS = [
  {
    id: 'payment',
    title: '缴费服务',
    items: [
      { id: 'arrears', title: '查欠费', prompt: '帮我查一下物业欠费', icon: '/assets/icons/fee.svg' },
      { id: 'property-payment', title: '物业缴费', prompt: '我要缴纳物业费', icon: '/assets/icons/wallet.svg' },
      { id: 'payment-history', title: '缴费记录', prompt: '帮我查缴费记录', icon: '/assets/icons/bill.svg' },
    ],
  },
  {
    id: 'delivery',
    title: '新房交付',
    items: [
      { id: 'delivery-ready', title: '交房准备', prompt: '交房前需要准备什么', icon: '/assets/icons/delivery.svg' },
      { id: 'delivery-booking', title: '预约交付', prompt: '我要预约交房', icon: '/assets/icons/building.svg' },
      { id: 'delivery-progress', title: '交房进度', prompt: '帮我查交房进度', icon: '/assets/icons/success.svg' },
    ],
  },
  {
    id: 'renovation',
    title: '装修服务',
    items: [
      { id: 'renovation-apply', title: '装修申请', prompt: '我要办理装修申请', icon: '/assets/icons/paint.svg' },
      { id: 'renovation-deposit', title: '装修押金', prompt: '我要查询装修押金', icon: '/assets/icons/fee.svg' },
      { id: 'renovation-progress', title: '装修巡查', prompt: '帮我看看装修办理进度', icon: '/assets/icons/renovation.svg' },
    ],
  },
  {
    id: 'other',
    title: '其他服务',
    items: [
      { id: 'move-apply', title: '搬家申请', prompt: '我要办理搬家申请', icon: '/assets/icons/home.svg' },
      { id: 'parking-payment', title: '停车缴费', prompt: '我要缴纳停车费', icon: '/assets/icons/wallet.svg' },
      { id: 'human-service', title: '联系人工', prompt: '请帮我联系人工客服', icon: '/assets/icons/service.svg' },
    ],
  },
];

const FEATURED_SERVICES = [
  {
    id: 'property-payment',
    title: '缴费中心',
    subtitle: '物业费、停车费在线缴纳',
    prompt: '我要缴纳物业费',
    icon: '/assets/icons/wallet.svg',
    tone: 'orange',
  },
  {
    id: 'delivery-ready',
    title: '新房交付',
    subtitle: '预约、验房与交接',
    prompt: '交房前需要准备什么',
    icon: '/assets/icons/building.svg',
    tone: 'green',
  },
  {
    id: 'renovation-apply',
    title: '装修办理',
    subtitle: '申请、押金与巡查',
    prompt: '我要办理装修申请',
    icon: '/assets/icons/paint.svg',
    tone: 'coral',
  },
];

const BILLS = [
  {
    id: 'bill-demo-property-001',
    houseId: CURRENT_HOUSE.id,
    period: '演示账期',
    feeType: '模拟住宅物业服务费',
    dueDate: '2099-12-31',
    status: 'UNPAID',
    items: [
      { id: 'property-service', title: '住宅物业服务费', amountFen: 68000 },
    ],
  },
];

const DEMO_DELAYS = {
  businessMs: 520,
  paymentMs: 900,
  voiceMs: 650,
  aiTimeoutMs: 8000,
};

module.exports = {
  BRAND,
  CURRENT_HOUSE,
  QUICK_INTENTS,
  SERVICE_GROUPS,
  FEATURED_SERVICES,
  BILLS,
  DEMO_DELAYS,
};
