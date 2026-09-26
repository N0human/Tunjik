import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CoilPlate } from '../components/CoilPlate';
import type { InterfaceLanguage } from '../i18n';

// Reading sizes, not a raw multiplier: the steps are chosen so the layout
// still holds at both ends. They live in the domain in Arahet; here they stay
// next to the shell until the progress store takes them over.
const FONT_SCALES = [1, 1.1, 1.2, 1.3, 1.4, 1.5] as const;
type FontScale = (typeof FONT_SCALES)[number];

const GAME_FAMILIES = {
  screen: ['pairs', 'bingo', 'srs'],
  round: ['quiz', 'reverse', 'listen', 'catch-letter', 'typing', 'dictation', 'constructor', 'translit', 'number-marathon', 'fill-letter', 'odd-one'],
} as const;

const PLANNED = {
  entries: 2141,
  decks: 20,
  games: 14,
  audio: 3139,
} as const;

type View = 'home' | 'settings' | 'about';

export function App() {
  const { t, i18n } = useTranslation();
  const [view, setView] = useState<View>('home');
  const [fontScale, setFontScale] = useState<FontScale>(1);
  const language: InterfaceLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';

  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', String(fontScale));
  }, [fontScale]);

  const navigate = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="site-shell">
      <header className="masthead">
        <button className="wordmark" onClick={() => navigate('home')} aria-label={t('accessibility.brandHome')}>
          <span className="wordmark-glyph" aria-hidden="true">Թ</span>
          <span className="wordmark-name">Пружинки<span className="wordmark-dot">.</span></span>
        </button>
        <nav className="main-nav" aria-label={t('accessibility.mainNavigation')}>
          <button className={view === 'home' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('home')}>{t('nav.home')}</button>
          <button className="nav-link" disabled title={t('common.plannedHint')}>{t('nav.decks')}</button>
          <button className="nav-link" disabled title={t('common.plannedHint')}>{t('nav.stats')}</button>
          <button className={view === 'about' ? 'nav-link active' : 'nav-link'} onClick={() => navigate('about')}>{t('nav.about')}</button>
        </nav>
        <div className="masthead-tools">
          <div className="language-switch">
            <span className="language-label">{t('common.language')}</span>
            <select
              value={language}
              aria-label={t('accessibility.languagePicker')}
              onChange={(event) => void i18n.changeLanguage(event.target.value)}
            >
              <option value="ru">ru</option>
              <option value="en">en</option>
            </select>
          </div>
          <span className="edition-mark"><i />tunjik</span>
          <button
            className={view === 'settings' ? 'masthead-icon active' : 'masthead-icon'}
            onClick={() => navigate('settings')}
            aria-label={t('accessibility.settings')}
          >⚙</button>
        </div>
      </header>

      {view === 'home' && <HomeView />}
      {view === 'settings' && (
        <SettingsView
          fontScale={fontScale}
          onFontScale={setFontScale}
          onReturn={() => navigate('home')}
        />
      )}
      {view === 'about' && <AboutView onReturn={() => navigate('home')} />}

      <div className="page-content">
        <footer className="page-footer">
          <span>{t('home.footer')}</span>
          <span>2026</span>
        </footer>
      </div>
    </div>
  );
}

function HomeView() {
  const { t } = useTranslation();
  const count = (value: number) => new Intl.NumberFormat('ru-RU').format(value);
  return (
    <main className="page-content">
      <div className="folio-topline">
        <span>{t('home.eyebrow')}</span>
        <span>{t('home.folio')}</span>
      </div>

      <section className="opening-spread">
        <div className="opening-copy">
          <p className="eyebrow"><span className="eyebrow-rule" />{t('home.eyebrow')}</p>
          <h1>{t('home.title')}</h1>
          <p className="opening-lead">{t('home.lead')}</p>
          <div className="opening-meta">
            <span><i className="meta-mark" />{count(PLANNED.entries)} {t('home.metaWords')}</span>
            <span><i className="meta-mark" />{PLANNED.decks} {t('home.metaDecks')}</span>
            <span><i className="meta-mark level-mark" />{PLANNED.games} {t('home.metaGames')}</span>
            <span><i className="meta-mark" />{count(PLANNED.audio)} {t('home.metaAudio')}</span>
          </div>
          <p className="planned-call">
            <span>{t('home.start')}</span>
            <span className="planned-mark">{t('common.planned')}</span>
          </p>
        </div>
        <div className="opening-art-wrap">
          <span className="folio-caption">{t('home.artTitle')}</span>
          <CoilPlate title={t('home.artTitle')} description={t('home.artDescription')} />
          <span className="art-side-note">{t('home.folioSideNote')}</span>
        </div>
      </section>

      <section className="route-section">
        <div className="route-heading">
          <div>
            <p className="eyebrow"><span className="eyebrow-rule" />{t('home.contentsLabel')}</p>
            <h2>{t('home.contentsTitle')}</h2>
          </div>
          <p>{t('home.contentsSub')}</p>
        </div>
        <div className="library-grid two">
          <LibraryGroup
            index="01"
            label={t('home.screenLabel')}
            note={t('home.screenSub')}
            items={GAME_FAMILIES.screen}
          />
          <LibraryGroup
            index="02"
            label={t('home.roundLabel')}
            note={t('home.roundSub')}
            items={GAME_FAMILIES.round}
          />
        </div>
      </section>

      <section className="audit-note">
        <p className="eyebrow"><span className="eyebrow-rule" />{t('home.auditLabel')}</p>
        <h2>{t('home.auditTitle')}</h2>
        <p>{t('home.auditBody')}</p>
      </section>
    </main>
  );
}

function LibraryGroup({
  index,
  label,
  note,
  items,
}: {
  index: string;
  label: string;
  note: string;
  items: readonly string[];
}) {
  const { t } = useTranslation();
  return (
    <div className="library-group">
      <p className="library-card-index">{index}</p>
      <strong>{label}</strong>
      <small>{note}</small>
      <ul className="library-list">
        {items.map((item) => (
          <li key={item}><code>{item}</code></li>
        ))}
      </ul>
      <span className="library-card-meta">{items.length} · {t('common.planned')}</span>
    </div>
  );
}

function SettingsView({
  fontScale,
  onFontScale,
  onReturn,
}: {
  fontScale: FontScale;
  onFontScale: (next: FontScale) => void;
  onReturn: () => void;
}) {
  const { t, i18n } = useTranslation();
  const language: InterfaceLanguage = i18n.resolvedLanguage === 'en' ? 'en' : 'ru';
  return (
    <main className="secondary-page">
      <div className="secondary-heading">
        <p className="eyebrow"><span className="eyebrow-rule" />{t('settings.eyebrow')}</p>
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.intro')}</p>
      </div>

      <div className="setting-row">
        <div className="setting-copy">
          <h2>{t('settings.textTitle')}</h2>
          <p>{t('settings.textHint')}</p>
        </div>
        <div className="setting-control">
          {FONT_SCALES.map((scale) => (
            <button
              key={scale}
              className={scale === fontScale ? 'setting-option active' : 'setting-option'}
              aria-pressed={scale === fontScale}
              onClick={() => onFontScale(scale)}
            >
              {scale.toFixed(1).replace('.', ',')}
            </button>
          ))}
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-copy">
          <h2>{t('settings.voiceTitle')}</h2>
          <p>{t('settings.voiceHint')}</p>
        </div>
        <div className="setting-control">
          <button className="setting-option" disabled>Նունե</button>
          <button className="setting-option" disabled>Տիգրան</button>
        </div>
      </div>
      <p className="about-note">{t('settings.voicePending')}</p>

      <div className="setting-row">
        <div className="setting-copy">
          <h2>{t('settings.audioTitle')}</h2>
          <p>{t('settings.audioHint')}</p>
        </div>
        <div className="setting-control">
          <label className="setting-switch">
            <input type="checkbox" disabled />
            <span>{t('common.planned')}</span>
          </label>
        </div>
      </div>

      <div className="setting-row">
        <div className="setting-copy">
          <h2>{t('settings.dataTitle')}</h2>
          <p>{t('settings.dataHint')}</p>
        </div>
      </div>

      <p className="settings-language">
        {t('common.language')}: {language.toUpperCase()}
      </p>
      <p><button className="text-button" onClick={onReturn}><span>←</span>{t('settings.nav')}</button></p>
    </main>
  );
}

function AboutView({ onReturn }: { onReturn: () => void }) {
  const { t } = useTranslation();
  return (
    <main className="secondary-page about-page">
      <div className="secondary-heading">
        <p className="eyebrow"><span className="eyebrow-rule" />{t('about.eyebrow')}</p>
        <h1>{t('about.title')}</h1>
        <p>{t('about.bodyFirst')}</p>
      </div>
      <div className="grammar-summary">
        <p>{t('about.bodySecond')}</p>
        <p>{t('about.bodyThird')}</p>
      </div>
      <div className="about-note">
        <p><b>{t('about.sourceLabel')}.</b> {t('about.sourceBody')}</p>
      </div>
      <p><button className="text-button" onClick={onReturn}><span>←</span>{t('about.back')}</button></p>
    </main>
  );
}
