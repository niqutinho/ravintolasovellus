import * as api from './api.js';

const state = {
  restaurants: [],
  position: null,
  nearestId: null,
  user: null,
  token: localStorage.getItem('token'),
  currentRestaurant: null,
  range: 'daily',
  registerMode: false,
  map: null,
  markers: new Map(),
};

const $ = (selector) => document.querySelector(selector);
const el = (tag, props = {}, ...children) => {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
};

// ---------- Apufunktiot ----------

/** Haversine-etäisyys kilometreinä. */
const distanceKm = (lat1, lon1, lat2, lon2) => {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
};

const getDistance = (restaurant) => {
  if (!state.position) return null;
  const [lon, lat] = restaurant.location.coordinates;
  return distanceKm(state.position.latitude, state.position.longitude, lat, lon);
};

const setStatus = (text) => { $('#status').textContent = text; };


// ---------- Kartta (Leaflet) ----------

const createMarkerIcon = (className) => L.divIcon({
  className: '',
  html: `<span class="pin ${className}"></span>`,
  iconSize: [22, 22],
  iconAnchor: [11, 11],
});

const initMap = () => {
  state.map = L.map('map').setView([64.5, 26], 5);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap-tekijät',
  }).addTo(state.map);
};

const renderMarkers = (restaurants) => {
  state.markers.forEach((marker) => marker.remove());
  state.markers.clear();

  restaurants.forEach((restaurant) => {
    const [lon, lat] = restaurant.location.coordinates;
    const isNearest = restaurant._id === state.nearestId;
    const isFavourite = restaurant._id === state.user?.favouriteRestaurant;
    const iconClass = isNearest ? 'nearest' : isFavourite ? 'favourite' : '';

    const marker = L.marker([lat, lon], {icon: createMarkerIcon(iconClass)})
      .addTo(state.map)
      .bindTooltip(restaurant.name);
    marker.on('click', () => openMenu(restaurant));
    state.markers.set(restaurant._id, marker);
  });

  if (restaurants.length) {
    const bounds = L.latLngBounds(restaurants.map((r) =>
      [r.location.coordinates[1], r.location.coordinates[0]]));
    state.map.fitBounds(bounds, {padding: [30, 30], maxZoom: 14});
  }
};

// ---------- Ravintolalista ----------

const fillSelect = (select, values) => {
  values.forEach((value) => select.append(el('option', {value, textContent: value})));
};

const getFilteredRestaurants = () => {
  const search = $('#search-input').value.trim().toLowerCase();
  const city = $('#city-filter').value;
  const company = $('#company-filter').value;

  return state.restaurants
    .filter((r) => !city || r.city === city)
    .filter((r) => !company || r.company === company)
    .filter((r) => `${r.name} ${r.address}`.toLowerCase().includes(search))
    .sort((a, b) => {
      // Suosikki ensin, sitten lähin, sitten aakkosjärjestys
      const favA = a._id === state.user?.favouriteRestaurant ? 0 : 1;
      const favB = b._id === state.user?.favouriteRestaurant ? 0 : 1;
      if (favA !== favB) return favA - favB;
      const distA = getDistance(a);
      const distB = getDistance(b);
      if (distA !== null && distB !== null) return distA - distB;
      return a.name.localeCompare(b.name, 'fi');
    });
};

const createRestaurantCard = (restaurant) => {
  const isFavourite = restaurant._id === state.user?.favouriteRestaurant;
  const isNearest = restaurant._id === state.nearestId;
  const distance = getDistance(restaurant);

  const card = el('li', {className: 'restaurant-card'});
  card.classList.toggle('nearest', isNearest);
  card.classList.toggle('favourite', isFavourite);

  const title = el('h2', {textContent: restaurant.name});
  const badges = el('div', {className: 'badges'});
  if (isNearest) badges.append(el('span', {className: 'badge', textContent: 'Lähin'}));
  if (isFavourite) badges.append(el('span', {className: 'badge fav', textContent: '★ Suosikki'}));

  const info = el('p', {
    textContent: `${restaurant.address}, ${restaurant.postalCode} ${restaurant.city}`,
  });
  const meta = el('p', {
    className: 'meta',
    textContent: [restaurant.company, distance !== null ? `${distance.toFixed(1)} km` : '']
      .filter(Boolean).join(' · '),
  });

  const actions = el('div', {className: 'actions'});
  const menuButton = el('button', {type: 'button', textContent: 'Ruokalista'});
  menuButton.addEventListener('click', () => openMenu(restaurant));
  actions.append(menuButton);

  if (state.user) {
    const favButton = el('button', {
      type: 'button',
      className: 'secondary',
      textContent: isFavourite ? 'Poista suosikeista' : 'Aseta suosikiksi',
    });
    favButton.addEventListener('click', () => toggleFavourite(restaurant));
    actions.append(favButton);
  }

  card.append(title, badges, info, meta, actions);
  return card;
};

const renderRestaurants = () => {
  const list = $('#restaurant-list');
  const restaurants = getFilteredRestaurants();
  list.replaceChildren(...restaurants.map(createRestaurantCard));
  renderMarkers(restaurants);
  setStatus(`${restaurants.length} ravintolaa`);
};

const updateNearest = () => {
  if (!state.position || !state.restaurants.length) return;
  const nearest = state.restaurants.reduce((best, r) =>
    getDistance(r) < getDistance(best) ? r : best);
  state.nearestId = nearest._id;
};

// ---------- Ruokalista ----------

const renderCourses = (courses) => {
  if (!courses?.length) return el('p', {textContent: 'Ei ruokalistaa saatavilla.'});
  const list = el('ul', {className: 'courses'});
  courses.forEach((course) => {
    list.append(el('li', {},
      el('strong', {textContent: course.name}),
      el('span', {className: 'price', textContent: course.price ? ` ${course.price}` : ''}),
      el('span', {className: 'diets', textContent: course.diets ? ` (${course.diets})` : ''}),
    ));
  });
  return list;
};

const loadMenu = async () => {
  const content = $('#menu-content');
  const lang = $('#language-select').value;
  const {_id} = state.currentRestaurant;
  content.replaceChildren(el('p', {textContent: 'Ladataan...'}));

  try {
    if (state.range === 'daily') {
      const menu = await api.getDailyMenu(_id, lang);
      content.replaceChildren(renderCourses(menu.courses));
    } else {
      const menu = await api.getWeeklyMenu(_id, lang);
      const days = menu.days.map((day) => el('section', {},
        el('h3', {textContent: new Date(day.date).toLocaleDateString('fi-FI', {
          weekday: 'long', day: 'numeric', month: 'numeric'})}),
        renderCourses(day.courses)));
      content.replaceChildren(...days);
    }
  } catch (error) {
    content.replaceChildren(el('p', {className: 'error', textContent: error.message}));
  }
};

const openMenu = (restaurant) => {
  state.currentRestaurant = restaurant;
  $('#menu-title').textContent = restaurant.name;
  $('#menu-dialog').showModal();
  loadMenu();
};

// ---------- Käyttäjä ----------

const renderUserNav = () => {
  const nav = $('#user-nav');
  if (!state.user) {
    const button = el('button', {type: 'button', textContent: 'Kirjaudu / Rekisteröidy'});
    button.addEventListener('click', () => openAuth(false));
    nav.replaceChildren(button);
    return;
  }
  const profileButton = el('button', {type: 'button', className: 'profile-button'});
  if (state.user.avatar) {
    profileButton.append(el('img', {
      className: 'avatar', alt: '', src: `${api.BASE_URL}/uploads/${state.user.avatar}`}));
  }
  profileButton.append(state.user.username);
  profileButton.addEventListener('click', openProfile);
  const logoutButton = el('button', {type: 'button', className: 'secondary', textContent: 'Kirjaudu ulos'});
  logoutButton.addEventListener('click', logout);
  nav.replaceChildren(profileButton, logoutButton);
};

const setUser = (user) => {
  state.user = user;
  renderUserNav();
  renderRestaurants();
};

const logout = () => {
  localStorage.removeItem('token');
  state.token = null;
  setUser(null);
};

const openAuth = (registerMode) => {
  state.registerMode = registerMode;
  $('#auth-title').textContent = registerMode ? 'Rekisteröityminen' : 'Kirjautuminen';
  $('#auth-submit').textContent = registerMode ? 'Rekisteröidy' : 'Kirjaudu';
  $('#auth-toggle').textContent = registerMode ? 'Onko sinulla tunnus? Kirjaudu' : 'Ei tunnusta? Rekisteröidy';
  $('#email-row').hidden = !registerMode;
  $('#email-row input').required = registerMode;
  $('#auth-message').textContent = '';
  $('#auth-dialog').showModal();
};

const handleAuthSubmit = async (event) => {
  event.preventDefault();
  const form = event.target;
  const data = Object.fromEntries(new FormData(form));
  const message = $('#auth-message');
  message.textContent = '';

  try {
    if (state.registerMode) {
      await api.register(data);
    }
    const result = await api.login({username: data.username, password: data.password});
    state.token = result.token;
    localStorage.setItem('token', result.token);
    setUser(result.data);
    form.reset();
    $('#auth-dialog').close();
  } catch (error) {
    message.textContent = error.message;
  }
};

const toggleFavourite = async (restaurant) => {
  const isFavourite = restaurant._id === state.user.favouriteRestaurant;
  try {
    await api.updateUser({favouriteRestaurant: isFavourite ? '' : restaurant._id}, state.token);
    setUser({...state.user, favouriteRestaurant: isFavourite ? null : restaurant._id});
  } catch (error) {
    setStatus(error.message);
  }
};

const openProfile = () => {
  const form = $('#profile-form');
  form.username.value = state.user.username;
  form.email.value = state.user.email;
  form.password.value = '';
  $('#profile-message').textContent = '';
  const preview = $('#avatar-preview');
  preview.replaceChildren();
  if (state.user.avatar) {
    preview.append(el('img', {
      className: 'avatar large',
      alt: 'Profiilikuva',
      src: `${api.BASE_URL}/uploads/${state.user.avatar}`,
    }));
  }
  $('#profile-dialog').showModal();
};

const handleProfileSubmit = async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.target));
  if (!data.password) delete data.password; // tyhjää salasanaa ei lähetetä
  const message = $('#profile-message');
  try {
    await api.updateUser(data, state.token);
    setUser({...state.user, username: data.username, email: data.email});
    message.textContent = 'Tiedot päivitetty.';
  } catch (error) {
    message.textContent = error.message;
  }
};

const handleAvatarSubmit = async (event) => {
  event.preventDefault();
  const file = event.target.avatar.files[0];
  try {
    await api.uploadAvatar(file, state.token);
    setUser(await api.getCurrentUser(state.token));
    openProfile();
  } catch (error) {
    $('#profile-message').textContent = error.message;
  }
};

// ---------- Alustus ----------

const initEventListeners = () => {
  ['#search-input', '#city-filter', '#company-filter'].forEach((selector) =>
    $(selector).addEventListener('input', renderRestaurants));
  $('#language-select').addEventListener('change', () => {
    if ($('#menu-dialog').open) loadMenu();
  });

  document.querySelectorAll('.tabs button').forEach((button) =>
    button.addEventListener('click', () => {
      state.range = button.dataset.range;
      document.querySelectorAll('.tabs button').forEach((b) =>
        b.classList.toggle('active', b === button));
      loadMenu();
    }));

  document.querySelectorAll('[data-close]').forEach((button) =>
    button.addEventListener('click', () => button.closest('dialog').close()));

  $('#auth-toggle').addEventListener('click', () => openAuth(!state.registerMode));
  $('#auth-form').addEventListener('submit', handleAuthSubmit);
  $('#profile-form').addEventListener('submit', handleProfileSubmit);
  $('#avatar-form').addEventListener('submit', handleAvatarSubmit);
};

const locateUser = () => {
  navigator.geolocation?.getCurrentPosition(({coords}) => {
    state.position = coords;
    updateNearest();
    renderRestaurants();
  }, () => {/* sijainti ei käytössä: lista näytetään ilman etäisyyksiä */});
};

const restoreSession = async () => {
  if (!state.token) return renderUserNav();
  try {
    setUser(await api.getCurrentUser(state.token));
  } catch {
    logout();
  }
};

const init = async () => {
  initEventListeners();
  initMap();
  setStatus('Ladataan ravintoloita...');
  try {
    state.restaurants = await api.getRestaurants();
    fillSelect($('#city-filter'), [...new Set(state.restaurants.map((r) => r.city))].sort());
    fillSelect($('#company-filter'), [...new Set(state.restaurants.map((r) => r.company))].sort());
    renderRestaurants();
    locateUser();
    await restoreSession();
  } catch (error) {
    setStatus(`Ravintoloiden lataus epäonnistui: ${error.message}`);
  }
};

init();
