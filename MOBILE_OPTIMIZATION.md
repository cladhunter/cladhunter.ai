# Mobile & Telegram Web App Optimization

## 📱 Overview

Cladhunter полностью оптимизирован для мобильных устройств и Telegram Web App (Mini Apps). Все компоненты, особенно система рекламы, адаптированы под вертикальные экраны телефонов.

---

## 🎯 Key Features

### Telegram Web App Integration

✅ **Auto-detection** - Определяет запуск в Telegram  
✅ **Auto-expand** - Автоматическое разворачивание на весь экран  
✅ **Haptic feedback** - Вибрация при взаимодействиях  
✅ **Safe area insets** - Учёт вырезов и закруглений экрана  
✅ **Theme integration** - Темная тема синхронизирована с Telegram  

### Mobile-Optimized Ad System

✅ **Full-screen immersion** - Реклама на весь экран (100dvh)  
✅ **9:16 aspect ratio** - Оптимальный формат для вертикальных видео  
✅ **Touch-optimized buttons** - Кнопки минимум 44-56px для удобного тапа  
✅ **Bottom-fixed controls** - Кнопка Claim всегда внизу экрана  
✅ **Progressive enhancement** - Работает везде, улучшения для Telegram  

---

## 🔧 Technical Implementation

### 1. Dynamic Viewport Height (dvh)

Используем `100dvh` вместо `100vh` для корректной работы на мобильных браузерах:

```css
height: 100vh;
height: 100dvh; /* Fallback with newer unit */
```

**Почему это важно:**
- Safari на iOS скрывает адресную строку → `100vh` некорректна
- `100dvh` учитывает динамическую высоту viewport
- Реклама всегда занимает весь видимый экран

### 2. Safe Area Insets

Учёт "безопасных зон" для устройств с вырезами (notch):

```css
padding-top: max(env(safe-area-inset-top, 0px) + 12px, 12px);
padding-bottom: max(env(safe-area-inset-bottom, 0px) + 16px, 16px);
```

**Области применения:**
- ✅ Верхний бейдж партнёра (не перекрывается notch)
- ✅ Нижняя кнопка Claim (не перекрывается home indicator)
- ✅ Прогресс-бар (правильное позиционирование)

### 3. Object-Fit: Cover

Реклама адаптируется под любой экран:

```tsx
<video
  className="w-full h-full object-cover"
  style={{ aspectRatio: '9/16' }}
/>
```

**Варианты поведения:**
- **Узкий экран** (< 9:16): Видео заполняет ширину, обрезается сверху/снизу
- **Широкий экран** (> 9:16): Видео заполняет высоту, обрезается по бокам
- **Точное соответствие** (= 9:16): Идеальное заполнение

### 4. Telegram WebApp API

```typescript
// utils/telegram.ts

// Инициализация при запуске
initTelegramWebApp();

// Хаптик при клике
hapticFeedback('notification', 'success');

// Открытие ссылок
openExternalLink(ad.partnerUrl);
```

**Функции:**
- `ready()` - Уведомление Telegram о готовности
- `expand()` - Разворачивание на весь экран
- `HapticFeedback` - Вибрация (легкая/средняя/сильная)
- `setBackgroundColor()` - Установка цвета темы

---

## 📐 Ad Modal Layout

### Mobile-First Design

```
┌─────────────────────────────┐
│ [Safe Area Top]             │ ← env(safe-area-inset-top)
│  [Partner Badge]            │
│                             │
│                             │
│       VIDEO/IMAGE           │
│       (9:16 ratio)          │
│       object-cover          │
│       100dvh height         │
│                             │
│                             │
│  [Progress Bar]             │ ← 116px from bottom
│  ▓▓▓▓▓▓░░░░░░░░░░░░░░       │
│                             │
│  [Dark Gradient Overlay]    │
│  ┌─────────────────────┐   │
│  │  🎁 CLAIM REWARD    │   │ ← 56px min height
│  └─────────────────────┘   │
│  "Watch for 5s..."          │
│ [Safe Area Bottom]          │ ← env(safe-area-inset-bottom)
└─────────────────────────────┘
```

### Responsive Breakpoints

**Mobile (default):**
- Width: 360px - 414px (common phone sizes)
- Height: 100dvh (dynamic viewport)
- Touch targets: 44-56px minimum

**Tablet (future):**
- Width: 768px+
- Layout может адаптироваться для горизонтальной ориентации

---

## 🎨 Visual Optimizations

### 1. Dark Gradient Overlay

Улучшает читаемость кнопки поверх светлых креативов:

```tsx
<div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
```

### 2. Shadow & Glow Effects

Кнопка выделяется на любом фоне:

```tsx
className="shadow-2xl shadow-[#FF0033]/60"
```

### 3. Scale Animation

Тактильная обратная связь при нажатии:

```tsx
className="active:scale-[0.98] transition-transform"
```

---

## 📊 Performance

### Optimizations Applied

1. **Lazy Video Loading**
   - `playsInline` - Воспроизведение без fullscreen
   - `autoPlay` - Автоматический старт
   - `muted={false}` - Звук включен (для рекламы)

2. **Smooth Animations**
   - `motion.div` от Framer Motion
   - Spring physics для натуральности
   - GPU-accelerated transforms

3. **Touch Optimization**
   - `touchAction: 'none'` - Предотвращение scroll
   - `-webkit-tap-highlight-color: transparent` - Убираем highlight
   - Минимальные touch targets (44px)

---

## 🧪 Testing Checklist

### Device Testing

- [ ] iPhone SE (375x667) - Маленький экран
- [ ] iPhone 12/13/14 (390x844) - Стандартный notch
- [ ] iPhone 14 Pro Max (430x932) - Dynamic Island
- [ ] Samsung Galaxy S21 (360x800) - Android notch
- [ ] Telegram Desktop - Web App режим

### Feature Testing

- [ ] Реклама занимает весь экран
- [ ] Кнопка Claim не перекрывается системными элементами
- [ ] Прогресс-бар виден и не съезжает
- [ ] Вибрация работает при клике (Telegram)
- [ ] Ссылка открывается корректно
- [ ] Видео воспроизводится автоматически
- [ ] Обратный отсчёт отображается правильно

### Edge Cases

- [ ] Очень узкий экран (320px)
- [ ] Очень широкий экран (tablet)
- [ ] Горизонтальная ориентация
- [ ] Медленный интернет (loading states)
- [ ] Видео не загрузилось (fallback)

---

## 🔍 Debugging

### Check Telegram Environment

```javascript
console.log('Is Telegram:', isTelegramWebApp());
console.log('Viewport:', getSafeViewportHeight());
console.log('WebApp:', getTelegramWebApp());
```

### Check Safe Areas

```javascript
const top = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-top)');
const bottom = getComputedStyle(document.documentElement).getPropertyValue('env(safe-area-inset-bottom)');
console.log('Safe areas:', { top, bottom });
```

### Visual Debugging

Добавьте временно для проверки границ:

```tsx
<div className="fixed top-0 left-0 right-0 h-1 bg-red-500 z-[10000]" 
     style={{ top: 'env(safe-area-inset-top)' }} />
<div className="fixed bottom-0 left-0 right-0 h-1 bg-red-500 z-[10000]" 
     style={{ bottom: 'env(safe-area-inset-bottom)' }} />
```

---

## 📱 Telegram Mini App Setup

### 1. BotFather Configuration

```
/newapp
Choose your bot: @YourBot
App title: Cladhunter
Description: Cloud mining simulator
Photo: Upload 640x360 screenshot
Demo GIF: Upload demo (optional)
URL: https://your-app.com
Short name: cladhunter
```

### 2. Manifest Setup

Уже настроен в `/tonconnect-manifest.json`:

```json
{
  "url": "https://your-app.com",
  "name": "Cladhunter",
  "iconUrl": "https://your-app.com/icon.png"
}
```

### 3. Launch Parameters

```javascript
// Получить параметры запуска
const webApp = getTelegramWebApp();
const startParam = webApp?.initDataUnsafe?.start_param;

// Например для реферальной системы
if (startParam?.startsWith('ref_')) {
  const referrerId = startParam.replace('ref_', '');
  // Handle referral
}
```

---

## 🚀 Best Practices

### DO ✅

- Используйте `100dvh` вместо `100vh`
- Добавляйте safe area insets
- Минимум 44px для touch targets
- Haptic feedback для важных действий
- Оптимизируйте для 9:16 формата
- Тестируйте на реальных устройствах

### DON'T ❌

- Не используйте `position: fixed` без учёта safe areas
- Не делайте кнопки меньше 44px
- Не блокируйте scroll без необходимости
- Не забывайте про медленный интернет
- Не игнорируйте горизонтальную ориентацию
- Не полагайтесь только на эмулятор

---

## 📊 Metrics to Track

### User Experience

- **Time to First Frame** - Скорость загрузки рекламы
- **Tap Success Rate** - % успешных кликов по кнопке
- **Video Completion Rate** - % досмотров до конца
- **Claim Rate** - % кликов по Claim vs закрытий

### Technical

- **Viewport Height** - Распределение размеров экранов
- **Device Types** - iOS vs Android vs Desktop
- **Telegram vs Web** - % пользователей из Telegram
- **Safe Area Usage** - Устройства с notch/Dynamic Island

---

## 🆕 Future Enhancements

### Planned

- [ ] Landscape mode support для планшетов
- [ ] Picture-in-Picture для видео
- [ ] Swipe gestures для скипа
- [ ] Adaptive bitrate для видео
- [ ] Preloading следующей рекламы

### Under Consideration

- [ ] Interactive ads (playable)
- [ ] Rewarded video chains
- [ ] A/B testing разных форматов
- [ ] Analytics dashboard

---

## 📚 Resources

- [Telegram Mini Apps Docs](https://core.telegram.org/bots/webapps)
- [iOS Safe Area Guide](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Mobile Touch Guidelines](https://web.dev/mobile-touch/)
- [Dynamic Viewport Units](https://developer.mozilla.org/en-US/docs/Web/CSS/length#dynamic-viewport-units)

---

**Updated:** October 21, 2025  
**Version:** 1.1.0  
**Platform:** Mobile-First, Telegram Mini Apps Ready
