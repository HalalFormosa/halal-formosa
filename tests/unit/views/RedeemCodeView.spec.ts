import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import en from '@/locales/en.json'
import RedeemCodeView from '@/views/business/RedeemCodeView.vue'
import { OfferService, OfferError, type CodeCheck } from '@/services/OfferService'

const ui = vi.hoisted(() => ({
  alerts: [] as any[],
  decode: null as null | ((text: string) => Promise<void>),
}))

vi.mock('@ionic/vue', () => {
  const box = { template: '<div><slot /></div>' }
  return {
    IonPage: box,
    IonHeader: box,
    IonContent: box,
    IonIcon: { template: '<i />' },
    IonSpinner: { template: '<i />' },
    IonButton: { props: ['type', 'disabled'], template: '<button :type="type || \'button\'" :disabled="disabled"><slot /></button>' },
    alertController: {
      create: vi.fn(async (options: any) => {
        ui.alerts.push(options)
        return { present: vi.fn() }
      }),
    },
    toastController: { create: vi.fn() },
    onIonViewWillEnter: vi.fn(),
    onIonViewWillLeave: vi.fn(),
  }
})
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/components/AppHeader.vue', () => ({ default: { template: '<header />' } }))
vi.mock('@/composables/useStoreAccess', () => ({ acceptPendingOwnerInvites: vi.fn() }))
vi.mock('@/services/ActivityLogService', () => ({ ActivityLogService: { log: vi.fn() } }))
vi.mock('html5-qrcode', () => ({
  Html5Qrcode: class {
    isScanning = false
    async start(_camera: unknown, _config: unknown, onDecode: (text: string) => Promise<void>) {
      ui.decode = onDecode
    }
    async stop() {}
    clear() {}
  },
}))

const CODE = 'MRMO-7K4Q-X9MP'

function checkResult(over: Partial<CodeCheck> = {}): CodeCheck {
  return {
    code: CODE,
    offer_title: 'Wagyu slices',
    discount_label: '10% off',
    location_name: 'Test Butcher',
    state: 'ok',
    redeemed_at: null,
    ...over,
  }
}

function mountView() {
  const i18n = createI18n({ legacy: false, locale: 'en', messages: { en } })
  return mount(RedeemCodeView, { global: { plugins: [i18n] } })
}

type View = ReturnType<typeof mountView>

async function submitCode(view: View, code = CODE) {
  await view.find('.code-input').setValue(code)
  await view.find('.code-form').trigger('submit')
  await flushPromises()
}

describe('RedeemCodeView: check first, then redeem', () => {
  let check: ReturnType<typeof vi.spyOn>
  let redeem: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.restoreAllMocks()
    ui.alerts.length = 0
    ui.decode = null
    check = vi.spyOn(OfferService, 'checkCode').mockResolvedValue(checkResult())
    redeem = vi.spyOn(OfferService, 'redeem').mockResolvedValue({
      code: CODE,
      offer_title: 'Wagyu slices',
      discount_label: '10% off',
      redeemed_at: '2026-11-27T12:00:00Z',
      location_name: 'Test Butcher',
    })
    vi.spyOn(OfferService, 'listMyRedemptions').mockResolvedValue([])
  })

  it('shows the code details after submitting, without redeeming', async () => {
    const view = mountView()
    await submitCode(view)

    expect(check).toHaveBeenCalledWith(CODE)
    expect(redeem).not.toHaveBeenCalled()
    const card = view.find('.pending')
    expect(card.text()).toContain('Wagyu slices')
    expect(card.text()).toContain('10% off')
    expect(card.text()).toContain('Test Butcher')
    expect(card.text()).toContain(CODE)
  })

  it('redeems only after the confirm button is pressed', async () => {
    const view = mountView()
    await submitCode(view)
    await view.find('.pending-confirm').trigger('click')
    await flushPromises()

    expect(redeem).toHaveBeenCalledTimes(1)
    expect(redeem).toHaveBeenCalledWith(CODE)
    expect(view.find('.pending').exists()).toBe(false)
    expect(view.find('.result.ok').text()).toContain('apply the discount now')
    expect((view.find('.code-input').element as HTMLInputElement).value).toBe('')
  })

  it('leaves the code unused when the check is cancelled', async () => {
    const view = mountView()
    await submitCode(view)
    await view.find('.pending-cancel').trigger('click')

    expect(view.find('.pending').exists()).toBe(false)
    expect(redeem).not.toHaveBeenCalled()
  })

  it('only checks a scanned code, without redeeming', async () => {
    const view = mountView()
    await view.find('.scan-btn').trigger('click')
    await flushPromises()
    await ui.decode!(CODE)
    await flushPromises()

    expect(check).toHaveBeenCalledWith(CODE)
    expect(redeem).not.toHaveBeenCalled()
    expect(view.find('.pending').exists()).toBe(true)
  })

  it.each([
    ['already_used', 'Already used on'],
    ['expired', 'This code has expired.'],
    ['offer_not_active', 'This discount is not active.'],
  ] as const)('explains a %s code and offers no confirm button', async (state, message) => {
    check.mockResolvedValue(checkResult({ state, redeemed_at: '2026-11-20T04:00:00Z' }))
    const view = mountView()
    await submitCode(view)

    expect(view.find('.pending').text()).toContain(message)
    expect(view.find('.pending-confirm').exists()).toBe(false)
  })

  it('reports an unknown code', async () => {
    check.mockRejectedValue(new OfferError('invalid_code'))
    const view = mountView()
    await submitCode(view)

    expect(view.find('.result.bad').text()).toContain("This code isn't valid for any of your stores.")
    expect(view.find('.pending').exists()).toBe(false)
  })

  it('drops the checked code once the input is edited', async () => {
    const view = mountView()
    await submitCode(view)
    await view.find('.code-input').setValue('MRMO-AAAA-BBBB')

    expect(view.find('.pending').exists()).toBe(false)
  })

  it('ignores a check that finishes after the input has changed', async () => {
    let finish!: (value: CodeCheck) => void
    check.mockReturnValue(new Promise<CodeCheck>((resolve) => { finish = resolve }))
    const view = mountView()
    await submitCode(view)
    await view.find('.code-input').setValue('MRMO-AAAA-BBBB')
    finish(checkResult())
    await flushPromises()

    expect(view.find('.pending').exists()).toBe(false)
  })

  it('shows why redeeming failed if the code changed after the check', async () => {
    redeem.mockRejectedValue(new OfferError('already_used', '2026-11-27 20:00'))
    const view = mountView()
    await submitCode(view)
    await view.find('.pending-confirm').trigger('click')
    await flushPromises()

    expect(view.find('.result.bad').text()).toContain('Already used on 2026-11-27 20:00.')
    expect(view.find('.pending').exists()).toBe(false)
  })
})

describe('RedeemCodeView: undo wording', () => {
  it('names both outcomes and only undoes on the destructive button', async () => {
    vi.restoreAllMocks()
    ui.alerts.length = 0
    vi.spyOn(OfferService, 'checkCode').mockResolvedValue(checkResult())
    vi.spyOn(OfferService, 'redeem').mockResolvedValue({
      code: CODE, offer_title: 'Wagyu slices', discount_label: null, redeemed_at: '2026-11-27T12:00:00Z',
    })
    vi.spyOn(OfferService, 'listMyRedemptions').mockResolvedValue([
      { code: CODE, offer_title: 'Wagyu slices', issued_at: '2026-11-27T11:00:00Z', redeemed_at: '2026-11-27T12:00:00Z', can_void: true },
    ])
    const voidSpy = vi.spyOn(OfferService, 'voidRedemption').mockResolvedValue()

    const view = mountView()
    await submitCode(view)
    await view.find('.pending-confirm').trigger('click')
    await flushPromises()
    await view.find('.h-undo').trigger('click')
    await flushPromises()

    const alert = ui.alerts[0]
    expect(alert.header).toBe('Mark this code as unused?')
    expect(alert.message).toBe(`Only do this if it was redeemed by mistake. The customer will be able to use ${CODE} again.`)
    expect(alert.buttons.map((b: any) => [b.text, b.role])).toEqual([
      ['Keep as used', 'cancel'],
      ['Mark as unused', 'destructive'],
    ])
    expect(voidSpy).not.toHaveBeenCalled()

    alert.buttons[1].handler()
    await flushPromises()
    expect(voidSpy).toHaveBeenCalledWith(CODE)
  })
})
