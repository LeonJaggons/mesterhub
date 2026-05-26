import Link from 'next/link'
import type { Locale } from '@/lib/i18n/config'
import {
  breadcrumbJsonLd,
  districtPath,
  districtServicePath,
  faqJsonLd,
  instantResultsPath,
  itemListJsonLd,
  localizedPath,
  localBusinessJsonLd,
  seoCategoryEntries,
  seoDistricts,
  serviceJsonLd,
  servicePath,
  translateSeoService,
  type SeoDistrict,
  type SeoServiceEntry,
} from '@/lib/seo'
import JsonLd from './JsonLd'

const featuredDistricts = ['Belváros-Lipótváros', 'Újbuda', 'Terézváros', 'Erzsébetváros', 'Angyalföld', 'Zugló']

function lower(value: string, locale: Locale): string {
  return value.toLocaleLowerCase(locale === 'hu' ? 'hu-HU' : 'en-US')
}

function districtLabel(district: SeoDistrict, locale: Locale): string {
  return locale === 'hu'
    ? `${district.roman}. kerület, ${district.name}`
    : `District ${district.roman}, ${district.name}`
}

function serviceIntro(entry: SeoServiceEntry, locale: Locale, district?: SeoDistrict): string {
  const service = lower(entry.labels[locale], locale)
  if (district) {
    return locale === 'hu'
      ? `A Mestermind segít megbízható ${service} szakembereket találni Budapest ${district.roman}. kerületében. Nézd meg a szolgáltatásokat, értékeléseket, árakat és elérhetőséget, mielőtt ajánlatot kérsz.`
      : `Mestermind helps you find trusted ${service} professionals in Budapest ${district.roman}. kerület (${district.name}). Compare services, reviews, prices, and availability before requesting a quote.`
  }
  return locale === 'hu'
    ? `Találj ellenőrzött budapesti szakembereket ${service} munkára. Keress kerület szerint, hasonlítsd össze az értékeléseket, és kérj ajánlatot gyorsan.`
    : `Find vetted Budapest professionals for ${service}. Search by district, compare reviews, and request quotes from local pros quickly.`
}

function districtIntro(district: SeoDistrict, locale: Locale): string {
  return locale === 'hu'
    ? `Budapest ${district.roman}. kerületében (${district.name}) ellenőrzött ezermestereket, szerelőket, takarítókat és más helyi szakembereket találsz a Mesterminden.`
    : `In Budapest District ${district.roman} (${district.name}), Mestermind helps you find vetted handymen, cleaners, plumbers, electricians, painters, and other local professionals.`
}

function serviceFaq(entry: SeoServiceEntry, locale: Locale, district?: SeoDistrict) {
  const service = entry.labels[locale]
  const area = district ? districtLabel(district, locale) : 'Budapest'
  if (locale === 'hu') {
    return [
      {
        question: `Hogyan találok ${lower(service, locale)} szakembert ${area} környékén?`,
        answer: `Válaszd ki a szolgáltatást és a kerületet, majd hasonlítsd össze az elérhető szakembereket ár, értékelés, tapasztalat és szolgáltatási terület alapján.`,
      },
      {
        question: 'Mennyibe kerül egy budapesti szakember?',
        answer: 'Az ár a munka típusától, sürgősségétől és helyszínétől függ. A Mesterminden több szakembertől kérhetsz ajánlatot, így könnyebb reális árat választani.',
      },
      {
        question: 'Minden szakember ellenőrzött?',
        answer: 'A profilokon láthatod az ellenőrzési, értékelési és tapasztalati információkat, így foglalás előtt átláthatóbb képet kapsz.',
      },
    ]
  }
  return [
    {
      question: `How do I find ${lower(service, locale)} pros in ${area}?`,
      answer: 'Choose the service and district, then compare available professionals by price, reviews, experience, and service area before requesting a quote.',
    },
    {
      question: 'How much do Budapest home services cost?',
      answer: 'Pricing depends on the work type, urgency, and location. Mestermind lets you request quotes from multiple pros so you can compare realistic local prices.',
    },
    {
      question: 'Are professionals on Mestermind vetted?',
      answer: 'Profiles show verification, reviews, experience, services, and availability signals so you can make a more confident hiring decision.',
    },
  ]
}

function districtFaq(district: SeoDistrict, locale: Locale) {
  if (locale === 'hu') {
    return [
      {
        question: `Milyen szakembereket találok ${district.name} környékén?`,
        answer: 'Ezermestereket, vízszerelőket, villanyszerelőket, festőket, takarítókat, költöztetőket és más budapesti szolgáltatókat kereshetsz kerület szerint.',
      },
      {
        question: 'Kérhetek több ajánlatot is?',
        answer: 'Igen. Írd le a munkát, add meg a kerületet, és hasonlítsd össze a releváns szakemberek ajánlatait.',
      },
      {
        question: 'Miért érdemes kerület szerint keresni?',
        answer: 'A helyi szakemberek gyorsabban elérhetők, jobban ismerik a környéket, és gyakran pontosabb árat tudnak adni kiszállásra és munkára.',
      },
    ]
  }
  return [
    {
      question: `What professionals can I find in ${district.name}?`,
      answer: 'You can search for handymen, plumbers, electricians, painters, cleaners, movers, and other Budapest service providers by district.',
    },
    {
      question: 'Can I request more than one quote?',
      answer: 'Yes. Describe the job, choose your district, and compare quotes from relevant local professionals.',
    },
    {
      question: 'Why search by Budapest district?',
      answer: 'Nearby professionals are often faster to schedule, understand local buildings better, and can give more accurate travel and job pricing.',
    },
  ]
}

function Breadcrumbs({
  locale,
  items,
}: {
  locale: Locale
  items: Array<{ label: string; href: string }>
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm text-gray-500">
      <ol className="flex flex-wrap gap-2">
        <li>
          <Link href={localizedPath(locale, '/')} className="hover:text-gray-900">
            {locale === 'hu' ? 'Főoldal' : 'Home'}
          </Link>
        </li>
        {items.map(item => (
          <li key={item.href} className="flex gap-2">
            <span aria-hidden="true">/</span>
            <Link href={item.href} className="hover:text-gray-900">
              {item.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  )
}

export function ServiceLanding({ entry, locale, district }: { entry: SeoServiceEntry; locale: Locale; district?: SeoDistrict }) {
  const label = entry.labels[locale]
  const headline = district
    ? locale === 'hu'
      ? `${label} ${district.name} környékén`
      : `${label} in ${district.name}, Budapest`
    : locale === 'hu'
      ? `${label} Budapesten`
      : `${label} in Budapest`
  const intro = serviceIntro(entry, locale, district)
  const faq = serviceFaq(entry, locale, district)
  const relatedDistricts = seoDistricts.filter(d => featuredDistricts.includes(d.name)).slice(0, 6)
  const relatedServices = seoCategoryEntries
    .filter(item => item.categoryName !== entry.categoryName)
    .slice(0, 6)
  const canonicalPath = district ? districtServicePath(district, entry, locale) : servicePath(entry, locale)
  const breadcrumbs = district
    ? [
      { name: 'Budapest', url: localizedPath(locale, '/') },
      { name: district.name, url: districtPath(district, locale) },
      { name: label, url: canonicalPath },
    ]
    : [
      { name: locale === 'hu' ? 'Szolgáltatások' : 'Services', url: canonicalPath },
      { name: label, url: canonicalPath },
    ]

  return (
    <main>
      <JsonLd data={[
        serviceJsonLd(entry, locale, district),
        localBusinessJsonLd(locale, district),
        breadcrumbJsonLd(breadcrumbs),
        faqJsonLd(faq),
        itemListJsonLd(relatedDistricts.map(item => ({
          name: districtLabel(item, locale),
          url: districtServicePath(item, entry, locale),
        }))),
      ]} />
      <section className="bg-slate-950 px-4 py-20 text-white">
        <div className="mx-auto max-w-5xl">
          <Breadcrumbs
            locale={locale}
            items={district ? [
              { label: district.name, href: districtPath(district, locale) },
              { label, href: canonicalPath },
            ] : [
              { label: locale === 'hu' ? 'Szolgáltatások' : 'Services', href: canonicalPath },
            ]}
          />
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-orange-300">
            {locale === 'hu' ? 'Budapesti szakemberkereső' : 'Budapest local services'}
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-none tracking-tight md:text-6xl">{headline}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{intro}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href={instantResultsPath(locale, entry, district)} className="rounded-lg bg-orange-500 px-6 py-3 text-center text-sm font-bold text-white hover:bg-orange-600">
              {locale === 'hu' ? 'Szakemberek megtekintése' : 'View available pros'}
            </Link>
            <Link href={localizedPath(locale, '/instant-results')} className="rounded-lg bg-white px-6 py-3 text-center text-sm font-bold text-gray-900 hover:bg-gray-100">
              {locale === 'hu' ? 'Összes szolgáltatás' : 'Browse all services'}
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.2fr_0.8fr]">
          <div>
            <h2 className="text-3xl font-black text-gray-900">
              {locale === 'hu' ? 'Miben segít a Mestermind?' : 'How Mestermind helps'}
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                locale === 'hu' ? 'Kerület szerinti keresés' : 'Search by district',
                locale === 'hu' ? 'Árak és értékelések' : 'Prices and reviews',
                locale === 'hu' ? 'Gyors ajánlatkérés' : 'Fast quote requests',
              ].map(item => (
                <div key={item} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                  <p className="font-bold text-gray-900">{item}</p>
                </div>
              ))}
            </div>
            <p className="mt-6 leading-8 text-gray-600">
              {locale === 'hu'
                ? `Akár kisebb javításról, sürgős segítségről vagy tervezett munkáról van szó, a Mestermind olyan budapesti szakembereket mutat, akik ${lower(label, locale)} területen dolgoznak.`
                : `Whether you need a small repair, urgent help, or planned work, Mestermind shows Budapest professionals who handle ${lower(label, locale)} jobs.`}
            </p>
          </div>
          <aside className="rounded-3xl bg-gray-50 p-6">
            <h2 className="text-xl font-black text-gray-900">{locale === 'hu' ? 'Népszerű munkák' : 'Popular jobs'}</h2>
            <ul className="mt-4 space-y-3">
              {entry.featuredServices.map(service => (
                <li key={service}>
                  <Link href={`${localizedPath(locale, '/instant-results')}?q=${encodeURIComponent(service)}`} className="text-sm font-semibold text-slate-700 hover:text-orange-600">
                    {translateSeoService(service, locale)}
                  </Link>
                </li>
              ))}
            </ul>
            {entry.regulated && entry.licenceNote ? (
              <p className="mt-5 rounded-xl bg-white p-4 text-sm leading-6 text-gray-600">
                {locale === 'hu'
                  ? 'Ehhez a kategóriához engedély vagy szakmai igazolás szükséges lehet. Mindig ellenőrizd a profil részleteit foglalás előtt.'
                  : 'This category may require licensing or professional credentials. Always check profile details before booking.'}
              </p>
            ) : null}
          </aside>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50 px-4 py-16">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-3xl font-black text-gray-900">
              {locale === 'hu' ? 'Keresés kerület szerint' : 'Search by district'}
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {relatedDistricts.map(item => (
                <Link key={item.id} href={districtServicePath(item, entry, locale)} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-600">
                  {districtLabel(item, locale)}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-3xl font-black text-gray-900">
              {locale === 'hu' ? 'Kapcsolódó szolgáltatások' : 'Related services'}
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {relatedServices.map(item => (
                <Link key={item.id} href={district ? districtServicePath(district, item, locale) : servicePath(item, locale)} className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-600">
                  {item.labels[locale]}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-black text-gray-900">
            {locale === 'hu' ? 'Gyakori kérdések' : 'Frequently asked questions'}
          </h2>
          <div className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {faq.map(item => (
              <div key={item.question} className="p-6">
                <h3 className="text-lg font-black text-gray-900">{item.question}</h3>
                <p className="mt-2 leading-7 text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}

export function DistrictLanding({ district, locale }: { district: SeoDistrict; locale: Locale }) {
  const faq = districtFaq(district, locale)
  const topServices = seoCategoryEntries.slice(0, 9)
  const breadcrumbs = [
    { name: 'Budapest', url: localizedPath(locale, '/') },
    { name: district.name, url: districtPath(district, locale) },
  ]

  return (
    <main>
      <JsonLd data={[
        localBusinessJsonLd(locale, district),
        breadcrumbJsonLd(breadcrumbs),
        faqJsonLd(faq),
        itemListJsonLd(topServices.map(item => ({
          name: item.labels[locale],
          url: districtServicePath(district, item, locale),
        }))),
      ]} />
      <section className="bg-slate-950 px-4 py-20 text-white">
        <div className="mx-auto max-w-5xl">
          <Breadcrumbs locale={locale} items={[{ label: district.name, href: districtPath(district, locale) }]} />
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-orange-300">
            {locale === 'hu' ? 'Budapest kerületei' : 'Budapest districts'}
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-none tracking-tight md:text-6xl">
            {locale === 'hu'
              ? `Szakemberek ${district.name} környékén`
              : `Local professionals in ${district.name}`}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">{districtIntro(district, locale)}</p>
          <div className="mt-8">
            <Link href={instantResultsPath(locale, undefined, district)} className="rounded-lg bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600">
              {locale === 'hu' ? 'Szakemberek keresése' : 'Find local pros'}
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-3xl font-black text-gray-900">
            {locale === 'hu' ? 'Népszerű szolgáltatások ebben a kerületben' : 'Popular services in this district'}
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topServices.map(item => (
              <Link key={item.id} href={districtServicePath(district, item, locale)} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-orange-300">
                <h3 className="text-xl font-black text-gray-900">{item.labels[locale]}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {locale === 'hu'
                    ? `Ellenőrzött szakemberek ${district.name} környékén.`
                    : `Vetted professionals around ${district.name}.`}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-gray-100 bg-gray-50 px-4 py-16">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-black text-gray-900">
            {locale === 'hu' ? 'Gyakori kérdések' : 'Frequently asked questions'}
          </h2>
          <div className="mt-6 divide-y divide-gray-100 rounded-2xl border border-gray-200 bg-white">
            {faq.map(item => (
              <div key={item.question} className="p-6">
                <h3 className="text-lg font-black text-gray-900">{item.question}</h3>
                <p className="mt-2 leading-7 text-gray-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
