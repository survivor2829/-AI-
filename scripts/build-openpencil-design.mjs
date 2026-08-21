import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import CanvasKitInit from 'canvaskit-wasm/full'
import { SkiaRenderer } from '@open-pencil/core/canvas'
import { renderJSX } from '@open-pencil/core/design-jsx'
import { FigmaAPI } from '@open-pencil/core/figma-api'
import { BUILTIN_IO_FORMATS, IORegistry } from '@open-pencil/core/io'
import { computeAllLayouts } from '@open-pencil/core/layout'
import { fontManager } from '@open-pencil/core/text'
import { SceneGraph } from '@open-pencil/scene-graph'

const ROOT = resolve(import.meta.dirname, '..')
const ICON_DIR = join(ROOT, 'design', 'assets', 'icons')
const IMAGE_PATH = join(ROOT, 'design', 'assets', 'images', 'community-landscape.png')
const OUTPUT_DIR = join(ROOT, 'artifacts', 'design')
const SCREEN_DIR = join(OUTPUT_DIR, 'screens')
const FIG_PATH = join(OUTPUT_DIR, '鱼水和AI物业助手-B高保真.fig')
const PNG_PATH = join(OUTPUT_DIR, '鱼水和AI物业助手-B高保真.png')

const COLORS = {
  canvas: '#F3ECE6',
  cream: '#FFF9F3',
  paper: '#FFFFFF',
  ink: '#2B211B',
  muted: '#665D57',
  line: '#E6D7CD',
  orange: '#E66D3F',
  action: '#B94F2C',
  orangeSoft: '#FFF0E6',
  coral: '#D86F56',
  coralSoft: '#FFF0EC',
  green: '#3F7D56',
  greenSoft: '#EAF7EE',
  blue: '#467FBF',
  blueSoft: '#ECF4FD',
  scrim: '#3E2D23',
}

const ICON_FILES = [
  'apps',
  'bill',
  'brand',
  'building',
  'chevron-down',
  'chevron',
  'delivery',
  'fee',
  'home',
  'mic',
  'more',
  'paint',
  'renovation',
  'robot',
  'send',
  'service',
  'success',
  'wallet',
]

function colorFromHex(hex) {
  const value = hex.replace('#', '')
  return {
    r: Number.parseInt(value.slice(0, 2), 16) / 255,
    g: Number.parseInt(value.slice(2, 4), 16) / 255,
    b: Number.parseInt(value.slice(4, 6), 16) / 255,
    a: 1,
  }
}

function jsxText(name, text, x, y, w, size, color, weight = 400, h = 24, align = 'left') {
  return `<Text name={${JSON.stringify(
    name,
  )}} x={${x}} y={${y}} w={${w}} h={${h}} font="Noto Sans SC" size={${size}} lineHeight={${Math.max(
    h,
    size + 6,
  )}} weight={${weight}} color={${color}} textAlign={${JSON.stringify(align)}} text={${JSON.stringify(
    text,
  )}} />`
}

async function registerChineseFonts() {
  const fontFiles = {
    Regular: 'C:\\Windows\\Fonts\\Noto Sans SC (TrueType).otf',
    Medium: 'C:\\Windows\\Fonts\\Noto Sans SC Medium (TrueType).otf',
    Bold: 'C:\\Windows\\Fonts\\Noto Sans SC Bold (TrueType).otf',
  }
  for (const [style, path] of Object.entries(fontFiles)) {
    const bytes = await readFile(path)
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    fontManager.markLoaded('Noto Sans SC', style, data)
  }
  fontManager.setCJKFallbackFamily('Noto Sans SC')
}

async function loadIconBodies() {
  const pairs = await Promise.all(
    ICON_FILES.map(async (name) => {
      const source = await readFile(join(ICON_DIR, `${name}.svg`), 'utf8')
      const match = source.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)
      if (!match) throw new Error(`Invalid SVG: ${name}`)
      return [name, match[1].trim()]
    }),
  )
  return Object.fromEntries(pairs)
}

function makeIcon(iconBodies, name, size = 20, color = COLORS.ink, label = name) {
  const body = iconBodies[name]
  if (!body) throw new Error(`Unknown icon: ${name}`)
  return `<svg name={${JSON.stringify(`Icon / ${label}`)}} w={${size}} h={${size}} viewBox="0 0 24 24" color={${JSON.stringify(
    color,
  )}} body={${JSON.stringify(body)}} />`
}

function makeHeader(iconBodies, variable) {
  const icon = (name, size, color, label) => makeIcon(iconBodies, name, size, color, label)
  return `
    <Frame name="App Header" x={0} y={0} w={390} h={112} bg={${variable('cream')}}>
      <Frame name="Brand Mark" x={20} y={18} w={44} h={44} flex="row" items="center" justify="center" bg={${variable(
        'action',
      )}} rounded={14}>
        ${icon('brand', 24, '#FFFFFF', 'brand')}
      </Frame>
      ${jsxText('Brand Name', '鱼水和 AI 物业助手', 76, 25, 220, 18, variable('ink'), 700, 28)}
      <Frame name="More Button" x={326} y={18} w={44} h={44} flex="row" items="center" justify="center" bg={${variable(
        'paper',
      )}} stroke={${variable('line')}} strokeWidth={1} rounded={22}>
        ${icon('more', 20, COLORS.ink, 'more')}
      </Frame>
      <Frame name="Current Home" x={20} y={70} w={350} h={32}>
        <Frame name="Home Icon" x={0} y={0} w={32} h={32} flex="row" items="center" justify="center">${icon(
          'home',
          18,
          COLORS.muted,
          'home',
        )}</Frame>
        ${jsxText('Current Home Label', '示范社区 · 演示房屋101', 36, 5, 208, 13, variable('muted'), 500, 22)}
        <Frame name="Open Home Selector" x={244} y={0} w={32} h={32} flex="row" items="center" justify="center">${icon(
          'chevron-down',
          17,
          COLORS.muted,
          'open home selector',
        )}</Frame>
      </Frame>
    </Frame>`
}

function makeQuickCard(iconBodies, variable, x, label, sublabel, iconName, tone) {
  const icon = makeIcon(iconBodies, iconName, 19, COLORS[tone], label)
  return `
    <Frame name={${JSON.stringify(`Quick / ${label}`)}} x={${x}} y={410} w={111} h={76} bg={${variable(
      'paper',
    )}} stroke={${variable('line')}} strokeWidth={1} rounded={18} shadow="0 6 18 #5A3E2812">
      <Frame name="Quick Icon" x={10} y={19} w={36} h={36} flex="row" items="center" justify="center" bg={${variable(
        `${tone}Soft`,
      )}} rounded={12}>${icon}</Frame>
      ${jsxText('Quick Label', label, 52, 16, 54, 13, variable('ink'), 700, 22)}
      ${jsxText('Quick Sublabel', sublabel, 52, 39, 54, 12, variable('muted'), 400, 20)}
    </Frame>`
}

function makeServiceRow(iconBodies, variable, y, label, description, iconName, tone) {
  const icon = makeIcon(iconBodies, iconName, 20, COLORS[tone], label)
  return `
    <Frame name={${JSON.stringify(`Service Row / ${label}`)}} x={20} y={${y}} w={350} h={66} bg={${variable(
      'paper',
    )}} stroke={${variable('line')}} strokeWidth={1} rounded={18}>
      <Frame name="Service Icon" x={12} y={13} w={40} h={40} flex="row" items="center" justify="center" bg={${variable(
        `${tone}Soft`,
      )}} rounded={13}>${icon}</Frame>
      ${jsxText('Service Name', label, 64, 12, 220, 14, variable('ink'), 700, 22)}
      ${jsxText('Service Description', description, 64, 35, 240, 12, variable('muted'), 400, 20)}
      <Frame name="Chevron" x={306} y={11} w={44} h={44} flex="row" items="center" justify="center">
        ${makeIcon(iconBodies, 'chevron', 18, COLORS.muted, 'open')}
      </Frame>
    </Frame>`
}

function makeComposer(iconBodies, variable, y, placeholder) {
  return `
    <Frame name="Chat Composer" x={16} y={${y}} w={358} h={54} bg={${variable('paper')}} stroke={${variable(
      'orange',
    )}} strokeWidth={1} rounded={20} shadow="0 8 22 #5A3E2814">
      ${jsxText('Composer Placeholder', placeholder, 16, 15, 244, 12, variable('muted'), 400, 22)}
      <Frame name="Voice Button" x={258} y={5} w={44} h={44} flex="row" items="center" justify="center">
        ${makeIcon(iconBodies, 'mic', 22, COLORS.muted, 'voice')}
      </Frame>
      <Frame name="Send Button" x={304} y={5} w={44} h={44} flex="row" items="center" justify="center" bg={${variable(
        'action',
      )}} rounded={22}>
        ${makeIcon(iconBodies, 'send', 20, '#FFFFFF', 'send')}
      </Frame>
    </Frame>`
}

function makeDiscovery(iconBodies, variable, x) {
  return `
  <Frame name="State 01 / Discovery" x={${x}} y={150} w={390} h={844} bg={${variable(
    'cream',
  )}} stroke={${variable('line')}} strokeWidth={1} rounded={36} overflow="hidden" shadow="0 24 64 #5A3E2826">
    <Rectangle name="Community landscape" x={0} y={112} w={390} h={246} opacity={0.25} />
    ${makeHeader(iconBodies, variable)}
    <Frame name="AI Welcome" x={20} y={138} w={350} h={178}>
      <Frame name="AI Orb" x={139} y={0} w={72} h={72} flex="row" items="center" justify="center" bg={${variable(
        'orangeSoft',
      )}} rounded={26} shadow="0 12 30 #E66D3F24">
        ${makeIcon(iconBodies, 'robot', 40, COLORS.action, 'AI assistant')}
      </Frame>
      ${jsxText('Welcome Title', '今天想办理什么？', 0, 92, 350, 27, variable('ink'), 700, 36, 'center')}
      ${jsxText('Welcome Description', '告诉我您的需求，我来帮您办理', 0, 134, 350, 14, variable('muted'), 400, 24, 'center')}
    </Frame>
    <Frame name="Main Composer" x={20} y={330} w={350} h={64} bg={${variable('paper')}} stroke={${variable(
      'orange',
    )}} strokeWidth={1} rounded={22} shadow="0 10 26 #5A3E2816">
      ${jsxText('Main Placeholder', '请输入您的问题或需求…', 18, 20, 222, 13, variable('muted'), 400, 24)}
      <Frame name="Voice Button" x={242} y={10} w={44} h={44} flex="row" items="center" justify="center">
        ${makeIcon(iconBodies, 'mic', 22, COLORS.muted, 'voice')}
      </Frame>
      <Frame name="Send Button" x={294} y={10} w={44} h={44} flex="row" items="center" justify="center" bg={${variable(
        'action',
      )}} rounded={22}>${makeIcon(iconBodies, 'send', 20, '#FFFFFF', 'send')}</Frame>
    </Frame>
    ${makeQuickCard(iconBodies, variable, 20, '查欠费', '账单明细', 'fee', 'orange')}
    ${makeQuickCard(iconBodies, variable, 140, '装修进度', '实时查看', 'renovation', 'green')}
    ${makeQuickCard(iconBodies, variable, 259, '交房准备', '清单提醒', 'delivery', 'coral')}
    <Frame name="Service Sheet / Half" x={0} y={510} w={390} h={334} bg={${variable(
      'paper',
    )}} roundedTL={30} roundedTR={30} shadow="0 -12 36 #5A3E2818">
      <Rectangle name="Drag Handle" x={172} y={12} w={46} h={5} bg={${variable('line')}} rounded={3} />
      ${jsxText('Half Sheet Title', '也可以直接办理', 20, 32, 210, 18, variable('ink'), 700, 28)}
      <Frame name="All Services Button" x={274} y={24} w={96} h={44} flex="row" items="center" justify="center" bg={${variable(
        'orangeSoft',
      )}} rounded={15}>
        ${jsxText('All Services Label', '全部服务', 0, 0, 78, 13, variable('action'), 700, 22, 'center')}
      </Frame>
      ${makeServiceRow(iconBodies, variable, 76, '缴费中心', '物业费、停车费在线缴纳', 'wallet', 'orange')}
      ${makeServiceRow(iconBodies, variable, 148, '新房交付', '预约、验房与交接', 'building', 'green')}
      ${makeServiceRow(iconBodies, variable, 220, '装修办理', '申请、押金与巡查', 'paint', 'coral')}
    </Frame>
  </Frame>`
}

function makeChat(iconBodies, variable, x) {
  return `
  <Frame name="State 02 / Chat" x={${x}} y={150} w={390} h={844} bg={${variable('cream')}} stroke={${variable(
    'line',
  )}} strokeWidth={1} rounded={36} overflow="hidden" shadow="0 24 64 #5A3E2826">
    ${makeHeader(iconBodies, variable)}
    <Frame name="User Message" x={144} y={142} w={226} h={54} bg={${variable(
      'action',
    )}} rounded={18} roundedBR={6}>
      ${jsxText('User Message Text', '帮我查一下物业欠费', 16, 15, 194, 14, variable('paper'), 500, 24)}
    </Frame>
    <Frame name="AI Avatar" x={20} y={228} w={40} h={40} flex="row" items="center" justify="center" bg={${variable(
      'orangeSoft',
    )}} rounded={14}>${makeIcon(iconBodies, 'robot', 23, COLORS.action, 'AI assistant')}</Frame>
    <Frame name="AI Message" x={70} y={220} w={300} h={118} bg={${variable('paper')}} stroke={${variable(
      'line',
    )}} strokeWidth={1} rounded={18} roundedTL={6} shadow="0 8 22 #5A3E2812">
      ${jsxText('AI Message Title', '好的，正在查询当前房屋账单', 16, 16, 268, 14, variable('ink'), 700, 24)}
      ${jsxText('AI Message Body', '我会按照物业系统中的真实数据为您展示。', 16, 47, 268, 12, variable('muted'), 400, 42)}
      <Frame name="Typing Indicator" x={16} y={92} w={54} h={14} flex="row" items="center" gap={5}>
        <Ellipse w={6} h={6} bg={${variable('line')}} /><Ellipse w={6} h={6} bg={${variable(
          'line',
        )}} /><Ellipse w={6} h={6} bg={${variable('line')}} />
      </Frame>
    </Frame>
    <Frame name="Query Context" x={70} y={356} w={232} h={38} bg={${variable(
      'greenSoft',
    )}} rounded={14}>
      <Frame name="Context Icon" x={6} y={3} w={32} h={32} flex="row" items="center" justify="center">${makeIcon(
        iconBodies,
        'home',
        16,
        COLORS.green,
        'home',
      )}</Frame>
      ${jsxText('Query Context Text', '当前查询：演示房屋101', 42, 8, 180, 12, variable('green'), 500, 22)}
    </Frame>
    <Frame name="Collapsed Service Entry" x={20} y={706} w={140} h={46} bg={${variable(
      'paper',
    )}} stroke={${variable('line')}} strokeWidth={1} rounded={15}>
      <Frame name="Collapsed Service Icon" x={4} y={1} w={44} h={44} flex="row" items="center" justify="center">${makeIcon(
        iconBodies,
        'apps',
        18,
        COLORS.action,
        'all services',
      )}</Frame>
      ${jsxText('Collapsed Service Label', '全部服务', 50, 12, 78, 13, variable('ink'), 700, 22)}
    </Frame>
    ${jsxText('Collapsed Rule Note', '收起后不再自动弹回', 172, 718, 198, 12, variable('muted'), 400, 22, 'right')}
    ${makeComposer(iconBodies, variable, 774, '继续提问或办理其他事项…')}
  </Frame>`
}

function makeBill(iconBodies, variable, x) {
  return `
  <Frame name="State 03 / Bill" x={${x}} y={150} w={390} h={844} bg={${variable('cream')}} stroke={${variable(
    'line',
  )}} strokeWidth={1} rounded={36} overflow="hidden" shadow="0 24 64 #5A3E2826">
    ${makeHeader(iconBodies, variable)}
    <Frame name="User Message" x={144} y={132} w={226} h={50} bg={${variable('action')}} rounded={18} roundedBR={6}>
      ${jsxText('User Message Text', '帮我查一下物业欠费', 16, 13, 194, 14, variable('paper'), 500, 24)}
    </Frame>
    <Frame name="AI Avatar" x={20} y={214} w={40} h={40} flex="row" items="center" justify="center" bg={${variable(
      'orangeSoft',
    )}} rounded={14}>${makeIcon(iconBodies, 'robot', 23, COLORS.action, 'AI assistant')}</Frame>
    <Frame name="AI Result Message" x={70} y={204} w={300} h={82} bg={${variable('paper')}} stroke={${variable(
      'line',
    )}} strokeWidth={1} rounded={18} roundedTL={6}>
      ${jsxText('AI Result Title', '已为您查到 1 笔待缴账单', 16, 13, 268, 14, variable('ink'), 700, 24)}
      ${jsxText('AI Result Body', '请核对房屋、账期和金额。', 16, 43, 268, 12, variable('muted'), 400, 22)}
    </Frame>
    <Frame name="Bill Card" x={44} y={306} w={326} h={432} bg={${variable('paper')}} stroke={${variable(
      'orange',
    )}} strokeWidth={1} rounded={22} shadow="0 14 36 #5A3E2818">
      <Frame name="Bill Icon" x={16} y={18} w={46} h={46} flex="row" items="center" justify="center" bg={${variable(
        'orangeSoft',
      )}} rounded={15}>${makeIcon(iconBodies, 'bill', 24, COLORS.action, 'bill')}</Frame>
      ${jsxText('Bill Type', '模拟物业账单', 76, 17, 154, 12, variable('muted'), 500, 22)}
      ${jsxText('Bill Status Amount', '待缴（演示） ¥680.00', 76, 39, 170, 19, variable('ink'), 700, 28)}
      <Frame name="Pending Tag" x={244} y={22} w={66} h={32} flex="row" items="center" justify="center" bg={${variable(
        'coralSoft',
      )}} rounded={11}>${jsxText('Pending Tag Label', '待确认', 0, 0, 50, 12, variable('coral'), 700, 22, 'center')}</Frame>
      <Rectangle name="Divider 1" x={16} y={82} w={294} h={1} bg={${variable('line')}} />
      ${jsxText('House Label', '房屋', 16, 100, 90, 12, variable('muted'), 400, 22)}
      ${jsxText('House Value', '演示房屋101', 148, 100, 162, 13, variable('ink'), 700, 22, 'right')}
      ${jsxText('Period Label', '账期', 16, 136, 90, 12, variable('muted'), 400, 22)}
      ${jsxText('Period Value', '演示账期', 148, 136, 162, 13, variable('ink'), 700, 22, 'right')}
      ${jsxText('Fee Type Label', '费用类型', 16, 172, 90, 12, variable('muted'), 400, 22)}
      ${jsxText('Fee Type Value', '模拟住宅物业服务费', 148, 172, 162, 13, variable('ink'), 700, 22, 'right')}
      <Rectangle name="Divider 2" x={16} y={210} w={294} h={1} bg={${variable('line')}} />
      ${jsxText('Amount Label', '应缴金额', 16, 230, 100, 13, variable('ink'), 600, 24)}
      ${jsxText('Amount Value', '¥680.00', 150, 222, 160, 24, variable('action'), 700, 34, 'right')}
      <Frame name="View Details" x={16} y={282} w={126} h={48} flex="row" items="center" justify="center" bg={${variable(
        'paper',
      )}} stroke={${variable('line')}} strokeWidth={1} rounded={15}>${jsxText(
        'View Details Label',
        '查看明细',
        0,
        0,
        100,
        13,
        variable('ink'),
        700,
        22,
        'center',
      )}</Frame>
      <Frame name="Confirm Payment" x={152} y={282} w={158} h={48} flex="row" items="center" justify="center" bg={${variable(
        'action',
      )}} rounded={15}>${jsxText('Confirm Payment Label', '确认缴费', 0, 0, 132, 13, variable('paper'), 700, 22, 'center')}</Frame>
      <Frame name="Truth Guardrail" x={16} y={346} w={294} h={56} bg={${variable(
        'greenSoft',
      )}} rounded={14}>
        <Frame name="Verified Icon" x={4} y={6} w={44} h={44} flex="row" items="center" justify="center">${makeIcon(
          iconBodies,
          'success',
          18,
          COLORS.green,
          'verified',
        )}</Frame>
        ${jsxText('Truth Guardrail Text', '金额来自物业业务数据，AI 不生成金额', 48, 9, 236, 12, variable('green'), 500, 38)}
      </Frame>
    </Frame>
    ${makeComposer(iconBodies, variable, 774, '有疑问可以继续问我…')}
  </Frame>`
}

function makeServiceTile(iconBodies, variable, x, y, label, iconName, tone) {
  return `
    <Frame name={${JSON.stringify(`Service Tile / ${label}`)}} x={${x}} y={${y}} w={106} h={64} flex="col" items="center" justify="center" gap={5} bg={${variable(
      'cream',
    )}} stroke={${variable('line')}} strokeWidth={1} rounded={16}>
      ${makeIcon(iconBodies, iconName, 21, COLORS[tone], label)}
      ${jsxText('Service Tile Label', label, 0, 0, 90, 12, variable('ink'), 700, 20, 'center')}
    </Frame>`
}

function makeServiceGroup(iconBodies, variable, y, title, items) {
  const tiles = items
    .map((item, index) => makeServiceTile(iconBodies, variable, 20 + index * 116, y + 28, ...item))
    .join('\n')
  return `${jsxText(`Group / ${title}`, title, 20, y, 180, 13, variable('ink'), 700, 22)}${tiles}`
}

function makeServices(iconBodies, variable, x) {
  return `
  <Frame name="State 04 / Services" x={${x}} y={150} w={390} h={844} bg={${variable(
    'cream',
  )}} stroke={${variable('line')}} strokeWidth={1} rounded={36} overflow="hidden" shadow="0 24 64 #5A3E2826">
    <Frame name="Muted Content" x={0} y={0} w={390} h={844} opacity={0.42}>
      ${makeHeader(iconBodies, variable)}
      <Frame name="Muted User Message" x={144} y={148} w={226} h={50} bg={${variable('action')}} rounded={18} roundedBR={6}>
        ${jsxText('Muted User Text', '帮我查一下物业欠费', 16, 13, 194, 14, variable('paper'), 500, 24)}
      </Frame>
      <Frame name="Muted AI Message" x={20} y={222} w={274} h={58} bg={${variable('paper')}} stroke={${variable(
        'line',
      )}} strokeWidth={1} rounded={18}>${jsxText('Muted AI Text', '正在查询当前房屋账单…', 16, 16, 242, 13, variable('ink'), 600, 24)}</Frame>
    </Frame>
    <Rectangle name="Sheet Scrim" x={0} y={0} w={390} h={844} bg={${variable('scrim')}} opacity={0.18} />
    <Frame name="Service Sheet / Full" x={0} y={226} w={390} h={618} bg={${variable(
      'paper',
    )}} roundedTL={30} roundedTR={30} shadow="0 -14 40 #5A3E2824">
      <Rectangle name="Drag Handle" x={172} y={12} w={46} h={5} bg={${variable('line')}} rounded={3} />
      ${jsxText('Full Sheet Title', '全部服务', 20, 32, 180, 20, variable('ink'), 700, 30)}
      ${jsxText('Full Sheet Subtitle', '选择后仍可返回 AI 对话', 20, 62, 220, 12, variable('muted'), 400, 22)}
      <Frame name="Collapse Sheet" x={292} y={28} w={78} h={44} flex="row" items="center" justify="center" bg={${variable(
        'orangeSoft',
      )}} rounded={14}>${jsxText('Collapse Label', '收起', 0, 0, 56, 13, variable('action'), 700, 22, 'center')}</Frame>
      ${makeServiceGroup(iconBodies, variable, 98, '缴费服务', [
        ['查欠费', 'fee', 'orange'],
        ['物业缴费', 'wallet', 'orange'],
        ['缴费记录', 'bill', 'orange'],
      ])}
      ${makeServiceGroup(iconBodies, variable, 204, '新房交付', [
        ['交房准备', 'delivery', 'green'],
        ['预约交付', 'building', 'green'],
        ['交房进度', 'success', 'green'],
      ])}
      ${makeServiceGroup(iconBodies, variable, 310, '装修服务', [
        ['装修申请', 'paint', 'coral'],
        ['装修押金', 'fee', 'coral'],
        ['装修巡查', 'renovation', 'coral'],
      ])}
      ${makeServiceGroup(iconBodies, variable, 416, '其他服务', [
        ['搬家申请', 'home', 'blue'],
        ['停车缴费', 'wallet', 'blue'],
        ['联系人工', 'service', 'blue'],
      ])}
    </Frame>
  </Frame>`
}

function makeStateLabel(variable, x, number, title, subtitle) {
  return `
    <Frame name={${JSON.stringify(`State Label / ${number}`)}} x={${x + 6}} y={98} w={378} h={44}>
      <Frame name="State Number" x={0} y={0} w={40} h={40} flex="row" items="center" justify="center" bg={${variable(
        'ink',
      )}} rounded={13}>${jsxText('State Number Text', number, 0, 0, 32, 12, variable('paper'), 700, 20, 'center')}</Frame>
      ${jsxText('State Title', title, 54, 0, 170, 16, variable('ink'), 700, 24)}
      ${jsxText('State Subtitle', subtitle, 54, 22, 300, 12, variable('muted'), 400, 20)}
    </Frame>`
}

function makeBoard(iconBodies, variable) {
  const positions = [0, 466, 932, 1398]
  return `
  <Frame name="B / Warm Community / High Fidelity" w={1788} h={1118} bg={${variable('canvas')}}>
    ${jsxText('Board Eyebrow', 'HIGH-FIDELITY FLOW · NATIVE WECHAT MINI PROGRAM', 8, 8, 520, 12, variable('action'), 700, 22)}
    ${jsxText('Board Title', '鱼水和 AI 物业助手｜B · Warm Community', 8, 34, 700, 30, variable('ink'), 700, 42)}
    ${jsxText('Board Note', '同一套首页，通过抽屉三态完成“发现能力 → 对话办理 → 结构化确认 → 传统服务”。', 8, 72, 940, 14, variable('muted'), 400, 24)}
    <Frame name="Palette" x={1576} y={34} w={204} h={40} flex="row" gap={12} items="center" justify="end">
      <Ellipse w={32} h={32} bg={${variable('orange')}} /><Ellipse w={32} h={32} bg={${variable(
        'green',
      )}} /><Ellipse w={32} h={32} bg={${variable('cream')}} stroke={${variable(
        'line',
      )}} strokeWidth={1} /><Ellipse w={32} h={32} bg={${variable('ink')}} />
    </Frame>
    ${makeStateLabel(variable, positions[0], '01', '能力发现', '首次进入 · 抽屉半展开')}
    ${makeStateLabel(variable, positions[1], '02', '进入对话', '发送消息 · 抽屉自动收起')}
    ${makeStateLabel(variable, positions[2], '03', '账单与确认', 'AI 返回结构化业务卡')}
    ${makeStateLabel(variable, positions[3], '04', '全部服务', '用户主动展开传统入口')}
    ${makeDiscovery(iconBodies, variable, positions[0])}
    ${makeChat(iconBodies, variable, positions[1])}
    ${makeBill(iconBodies, variable, positions[2])}
    ${makeServices(iconBodies, variable, positions[3])}
    <Frame name="Interaction Rules" x={0} y={1024} w={1788} h={82} bg={${variable('line')}} rounded={22} overflow="hidden">
      <Frame name="Rule / Auto Show" x={1} y={1} w={446} h={80} bg={${variable('paper')}}>
        ${jsxText('Rule Title', '自动出现', 20, 16, 120, 14, variable('ink'), 700, 22)}
        ${jsxText('Rule Body', '仅首次进入或新建空白会话', 20, 42, 380, 12, variable('muted'), 400, 22)}
      </Frame>
      <Frame name="Rule / Auto Collapse" x={448} y={1} w={446} h={80} bg={${variable('paper')}}>
        ${jsxText('Rule Title', '自动收起', 20, 16, 120, 14, variable('ink'), 700, 22)}
        ${jsxText('Rule Body', '输入、语音、快捷意图、键盘弹起', 20, 42, 380, 12, variable('muted'), 400, 22)}
      </Frame>
      <Frame name="Rule / User Opens" x={895} y={1} w={446} h={80} bg={${variable('paper')}}>
        ${jsxText('Rule Title', '主动展开', 20, 16, 120, 14, variable('ink'), 700, 22)}
        ${jsxText('Rule Body', '点击“全部服务”或上拉把手', 20, 42, 380, 12, variable('muted'), 400, 22)}
      </Frame>
      <Frame name="Rule / Do Not Disturb" x={1342} y={1} w={445} h={80} bg={${variable('paper')}}>
        ${jsxText('Rule Title', '不再打扰', 20, 16, 120, 14, variable('ink'), 700, 22)}
        ${jsxText('Rule Body', '同一段对话中，收起后不自动弹回', 20, 42, 390, 12, variable('muted'), 400, 22)}
      </Frame>
    </Frame>
  </Frame>`
}

async function makeRenderer() {
  const ckEntry = import.meta.resolve('canvaskit-wasm/full')
  const ckDir = dirname(fileURLToPath(ckEntry))
  const ck = await CanvasKitInit({ locateFile: (file) => join(ckDir, file) })
  const surface = ck.MakeSurface(1, 1)
  if (!surface) throw new Error('Failed to create CanvasKit surface')
  const renderer = new SkiaRenderer(ck, surface)
  renderer.viewportWidth = 1
  renderer.viewportHeight = 1
  renderer.dpr = 1
  await renderer.loadFonts()
  return { ck, renderer }
}

async function main() {
  await registerChineseFonts()
  const iconBodies = await loadIconBodies()
  const graph = new SceneGraph()
  const figma = new FigmaAPI(graph)
  const page = graph.getPages()[0]
  graph.updateNode(page.id, { name: 'B｜Warm Community 高保真' })

  const collection = figma.createVariableCollection('Warm Community Tokens')
  const variables = Object.fromEntries(
    Object.entries(COLORS).map(([name, value]) => [
      name,
      figma.createVariable(name, 'COLOR', collection.id, colorFromHex(value)),
    ]),
  )
  const variable = (name) => {
    const token = variables[name]
    if (!token) throw new Error(`Unknown color token: ${name}`)
    return `designVar({ id: ${JSON.stringify(token.id)}, name: ${JSON.stringify(
      token.name,
    )}, value: ${JSON.stringify(COLORS[name])} })`
  }

  const [result] = await renderJSX(graph, makeBoard(iconBodies, variable))
  if (result.warnings?.length) console.warn(result.warnings.join('\n'))

  const communityNode = [...graph.getAllNodes()].find((node) => node.name === 'Community landscape')
  if (!communityNode) throw new Error('Community image slot was not created')
  const image = figma.createImage(new Uint8Array(await readFile(IMAGE_PATH)))
  const communityProxy = figma.getNodeById(communityNode.id)
  communityProxy.fills = [
    {
      type: 'IMAGE',
      color: colorFromHex('#FFFFFF'),
      opacity: 1,
      visible: true,
      imageHash: image.hash,
      imageScaleMode: 'FILL',
    },
  ]

  computeAllLayouts(graph, page.id)
  await mkdir(SCREEN_DIR, { recursive: true })

  const io = new IORegistry(BUILTIN_IO_FORMATS)
  const { ck, renderer } = await makeRenderer()
  let restoreTextMeasurer
  try {
    restoreTextMeasurer = await renderer.prepareForExport(graph, page.id, page.childIds)

    const fig = await io.writeDocument(
      'fig',
      graph,
      { thumbnailPageId: page.id, renderThumbnail: true },
      { canvasKit: ck, renderer },
    )
    await writeFile(FIG_PATH, fig.data)

    const board = await io.exportContent(
      'png',
      { graph, target: { scope: 'page', pageId: page.id } },
      { format: 'PNG', scale: 1 },
      { canvasKit: ck, renderer },
    )
    await writeFile(PNG_PATH, board.data)

    const screens = [
      ['State 01 / Discovery', '01-能力发现.png'],
      ['State 02 / Chat', '02-进入对话.png'],
      ['State 03 / Bill', '03-账单确认.png'],
      ['State 04 / Services', '04-全部服务.png'],
    ]
    for (const [nodeName, fileName] of screens) {
      const node = [...graph.getAllNodes()].find((candidate) => candidate.name === nodeName)
      if (!node) throw new Error(`Screen not found: ${nodeName}`)
      const imageResult = await io.exportContent(
        'png',
        { graph, target: { scope: 'node', nodeId: node.id } },
        { format: 'PNG', scale: 1 },
        { canvasKit: ck, renderer },
      )
      await writeFile(join(SCREEN_DIR, fileName), imageResult.data)
    }

    console.log(`Built ${FIG_PATH}`)
    console.log(`Exported ${PNG_PATH}`)
  } finally {
    restoreTextMeasurer?.()
    renderer.destroy()
  }
}

await main()
