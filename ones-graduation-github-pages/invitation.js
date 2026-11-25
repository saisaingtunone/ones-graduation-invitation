import { graduationPhotos } from './graduation-photos.js';
import { initGalaxy } from './galaxy.js';
import { initPaperReveal } from './paper-reveal.js';
import { initCoverflow, initPhotoSpiral } from './photo-motion.js';
import { initFoldText, initStarBorders, playAnimatedContent, rollCountdownNumber } from './text-motion.js';

const cover = document.querySelector('#cover');
const openButton = document.querySelector('#open-invite');
const invitation = document.querySelector('#invitation');
const heading = document.querySelector('#invitation-title');
const invitationCopy = document.querySelector('.hero-copy');
const envelopeLetter = document.querySelector('.envelope__letter-border');
const replayButton = document.querySelector('#replay');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const countdownOptions = [...document.querySelectorAll('[data-target]')];
const countdownUnits = [...document.querySelectorAll('[data-unit]')];
const countdown = document.querySelector('#countdown');
const countdownStatus = document.querySelector('#countdown-status');
const musicAudio = document.querySelector('#graduation-music');
const musicButtons = [...document.querySelectorAll('[data-music-button]')];
const musicStatus = document.querySelector('#music-status');

let selectedEvent = countdownOptions.find((button) => button.getAttribute('aria-pressed') === 'true');
let countdownInterval;

function updateCountdown() {
  const secondsLeft = Math.max(0, Math.ceil((Date.parse(selectedEvent.dataset.target) - Date.now()) / 1000));
  const values = [
    Math.floor(secondsLeft / 86400),
    Math.floor(secondsLeft / 3600) % 24,
    Math.floor(secondsLeft / 60) % 60,
    secondsLeft % 60,
  ];

  const animate = !motionPreference.matches && countdown.classList.contains('is-unfolded');
  countdownUnits.forEach((unit, index) => {
    rollCountdownNumber(unit, String(values[index]).padStart(2, '0'), animate);
  });

  countdownStatus.hidden = secondsLeft > 0;
  if (secondsLeft === 0) countdownStatus.textContent = selectedEvent.dataset.started;
}

countdownOptions.forEach((button) => {
  button.addEventListener('click', () => {
    selectedEvent.setAttribute('aria-pressed', 'false');
    selectedEvent = button;
    selectedEvent.setAttribute('aria-pressed', 'true');
    updateCountdown();
  });
});

function setMusicState(state) {
  const playing = state === 'playing';
  musicStatus.textContent = state === 'unavailable' ? 'Background music couldn’t start in this browser.' : '';

  musicButtons.forEach((button) => {
    const label = button.querySelector('[data-music-label]');
    button.setAttribute('aria-pressed', String(playing));
    label.textContent = label.dataset[state];
  });
}

function toggleMusic() {
  if (!musicAudio.paused) {
    musicAudio.pause();
    return;
  }

  setMusicState('loading');
  musicAudio.play().catch((error) => {
    if (error.name !== 'AbortError') setMusicState('unavailable');
  });
}

musicButtons.forEach((button) => button.addEventListener('click', toggleMusic));
musicAudio.addEventListener('playing', () => {
  if (!musicAudio.paused) setMusicState('playing');
});
musicAudio.addEventListener('pause', () => {
  if (musicAudio.paused && !musicAudio.error) setMusicState('off');
});
musicAudio.addEventListener('error', () => setMusicState('unavailable'));

function showInvitation() {
  updateCountdown();
  countdownInterval = window.setInterval(updateCountdown, 1000);
  invitation.hidden = false;
  cover.hidden = true;
  cover.classList.remove('is-opening');
  if (!motionPreference.matches) playAnimatedContent(invitationCopy);
  heading.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' });
}

openButton.addEventListener('click', () => {
  if (openButton.getAttribute('aria-expanded') === 'true') return;

  openButton.setAttribute('aria-expanded', 'true');

  if (motionPreference.matches) {
    showInvitation();
    return;
  }

  cover.classList.add('is-opening');
  playAnimatedContent(envelopeLetter, { distance: 18, delay: 610, duration: 560 });
  window.setTimeout(showInvitation, 1530);
});

replayButton.addEventListener('click', () => {
  window.clearInterval(countdownInterval);
  musicAudio.pause();
  setMusicState('off');
  invitation.hidden = true;
  cover.hidden = false;
  openButton.setAttribute('aria-expanded', 'false');
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  window.scrollTo({ top: 0, behavior: 'instant' });
  openButton.focus({ preventScroll: true });
});

initFoldText();
initStarBorders();
initPhotoSpiral(graduationPhotos, motionPreference);
initCoverflow(graduationPhotos, motionPreference);
initGalaxy(document.querySelector('#galaxy-background'), motionPreference);
initPaperReveal(document.querySelector('#letter-stage'), motionPreference);
