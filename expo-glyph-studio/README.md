<div align="center">

# ✦ NOTHING GLYPH STUDIO

**Ультимативная студия управления Glyph-интерфейсом для Nothing Phone в стиле Liquid Glass**

[![Release](https://img.shields.io/github/v/release/cernokalskijgerman-arch/test?style=for-the-badge&color=00E5FF&label=APK%20RELEASE)](https://github.com/cernokalskijgerman-arch/test/releases/latest)
[![Platform](https://img.shields.io/badge/Platform-Android%20(Nothing%20OS)-000000?style=for-the-badge&logo=android&logoColor=white)](https://github.com/cernokalskijgerman-arch/test/releases/latest)
[![React Native](https://img.shields.io/badge/React%20Native-0.76-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactnative.dev/)
[![Expo](https://img.shields.io/badge/Expo-SDK%2052-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)

*Прямое аппаратное управление 36 микро-светодиодами через нативный Nothing Ketchum SDK 2.0, реальный FFT-анализ системного звука и плавный интерфейс в эстетике Liquid Glass.*

[Скачать APK](https://github.com/cernokalskijgerman-arch/test/releases/latest) • [Возможности](#-возможности-приложения) • [Архитектура](#-архитектура-и-железо) • [Сборка](#-локальная-сборка)

</div>

---

## 📱 Установка APK

1. Скачайте последний **`NothingGlyphStudio.apk`** со страницы [**Releases**](https://github.com/cernokalskijgerman-arch/test/releases/latest).
2. При обновлении со старой версии предварительно удалите предыдущую сборку.
3. Установите APK на устройство Nothing Phone и выдайте разрешение на микрофон при первом запуске раздела **«Музыка»** (требуется Android для системного `Visualizer` и `AudioRecord` FFT).

---

## ✨ Возможности приложения

### 1. 🎛 КОНТРОЛЬ — Мастер-управление и 3 дуги
- Интерактивный векторный силуэт блока камер с живой подсветкой всех **36 микро-LED**:
  - **Верх-Лево** — 20 LED (`#0..19`)
  - **Правый** — 11 LED (`#20..30`)
  - **Низ-Лево** — 5 LED (`#31..35`)
- Мгновенное переключение каждой дуги нажатием прямо на силуэт или кнопку.
- Неразрушающий **Мастер-диммер (`0..255`)** с быстрыми пресетами (`0%`, `25%`, `50%`, `75%`, `100%`) и сохранением пользовательского баланса дуг.

### 2. 🌀 АВТО-ОБХОД — 60 FPS движок бегущего света
- **6 режимов движения:** `ВПЕРЕД`, `КОМЕТА`, `НАЗАД`, `МАЯТНИК`, `ИСКРЫ`, `БЛЕСК`.
- Регулировка скорости шага от **1 мс (ГИПЕР)** до **200 мс** с угловой нормализацией по длине дуг.
- В диапазоне `1–15 мс` включается фазовый аккумулятор **60 FPS** со шлейфом без рывков и пропусков кадров.

### 3. 🎹 СЕКВЕНСОР — 8-шаговая ритм-матрица
- Монохромная матрица в стиле **Liquid Glass** (3 дорожки × 8 шагов, Такт 1–4 / Такт 5–8) с регулировкой яркости каждой дорожки.
- Управление в реальном времени без перезапуска цикла: **BPM (`40–260`)**, **Gate (`20–100%`)**, **Swing (`0–60%`)**, общая интенсивность.
- Переключение режима вывода: **3 ДУГИ** или **ПИКСЕЛИ (36 LED)**.
- 5 встроенных пресетов (`CYBER`, `PULSE`, `STROBE`, `TECHNO`, `ECHO`) и 2 пользовательских слота (**МОЙ 1**, **МОЙ 2**) с сохранением при навигации.

### 4. 🎵 МУЗЫКА — Реальный FFT-визуализатор
- Нативный Android-анализатор **`RealAudioAnalyzer.kt`**:
  - Захват системного аудиомикса через Android `Visualizer` (без микрофона).
  - Автоматический fallback на `AudioRecord` с **1024-точечным Radix-2 FFT**.
- 16-полосный спектр, раздельные пик-детекторы **Bass / Mid / Treble** и обнаружение бита по спектральному потоку.
- **6 реактивных режимов:** `СПЕКТР EQ`, `БИТ-СТРОБ`, `ВОЛНА`, `ИСКРЫ`, `ГЛИЧ`, `РАДАР`.

### 5. 🛠 УТИЛИТЫ И АРКАДЫ
- **Стробоскоп (`1–25 Гц`):** точный фазовый таймер со скважностью `20–80%`.
- **Таймер обратного отсчёта:** плавное угасание 36 LED или 3 дуг с финальным сигналом.
- **Батарея HUD:** реальная телеметрия АКБ Android + тестовый режим.
- **Дыхание Дзен 4-7-8:** световой гид для дыхательных практик.
- **Маяк Морзе (ITU-R):** передача `SOS`, `HELP`, `NOTHING`, `OK`.
- **Мини-игры:** *«Меткий Глиф»*, *«Световая бутылочка»* и *«Рефлекс»*.

---

## ⚡ Полировка UX и производительность

- **Плавный Liquid Glass Tab Bar:** поддержка обычных нажатий, свайпов по экрану и перетаскивания пальцем по панели разделов (`press-and-drag scrubbing`) без конфликтов жестов.
- **Keep-Alive навигация:** экраны остаются смонтированными в памяти, благодаря чему переключение вкладок происходит мгновенно и **не прерывает / не вызывает мерцания** текущей Glyph-анимации.
- **Дедупликация кадров:** одинаковые состояния не дублируются в нативный мост Ketchum SDK.

---

## 🧱 Архитектура и железо

```text
expo-glyph-studio/
├── App.js                              # Координатор состояния, Keep-Alive вкладки и арбитраж Glyph-вывода
├── src/
│   ├── components/
│   │   ├── FloatingTabBar.js           # Reanimated Liquid Glass Tab Bar со скраббингом
│   │   ├── GlyphCameraSilhouette.js    # SVG-силуэт камеры и 36 микро-LED
│   │   ├── GlyphSlider.js              # Слайдер с защитой от конфликтов со скроллом
│   │   ├── LiquidGlassCard.js          # Карточка с BlurView и спекулярными бликами
│   │   └── CategorySwitcherModal.js    # Bottom Sheet быстрого выбора раздела
│   └── screens/                        # Control, Pixels, Sequencer, Visualizer, Utilities
└── modules/nothing-glyph/              # Нативный Expo-модуль (Kotlin + Ketchum SDK 2.0 + Radix-2 FFT)
```

- **Целевое устройство:** Nothing Phone (3a Pro) / `A059` (36 каналов), с поддержкой маппинга для Nothing Phone (1), (2) и (2a).
- **Нативный модуль:** `modules/nothing-glyph` (`NothingGlyphModule.kt`, `RealAudioAnalyzer.kt`, `glyph-matrix-sdk-2.0.jar`).

---

## 🛠 Локальная сборка

```bash
# Установка зависимостей
npm install

# Проверка бандла Android
npx expo export --platform android

# Сборка APK (Android)
cd android && ./gradlew assembleRelease
```

---

<div align="center">
<sub>Сделано на React Native, Expo и Nothing Ketchum SDK 2.0</sub>
</div>
