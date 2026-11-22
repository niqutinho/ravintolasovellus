const BASE_URL = 'https://media2.edu.metropolia.fi/restaurant';
const API_URL = `${BASE_URL}/api/v1`;

/**
 * Tekee pyynnön rajapintaan ja palauttaa JSON-vastauksen.
 * Heittää virheen, jos vastaus ei ole OK.
 */
const fetchJson = async (path, options = {}) => {
  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || `Pyyntö epäonnistui (${response.status})`);
  }
  return data;
};

const jsonOptions = (method, body, token) => ({
  method,
  headers: {
    'Content-Type': 'application/json',
    ...(token && {Authorization: `Bearer ${token}`}),
  },
  body: JSON.stringify(body),
});

const getRestaurants = () => fetchJson('/restaurants');
const getDailyMenu = (id, lang) => fetchJson(`/restaurants/daily/${id}/${lang}`);
const getWeeklyMenu = (id, lang) => fetchJson(`/restaurants/weekly/${id}/${lang}`);

const register = (user) => fetchJson('/users', jsonOptions('POST', user));
const login = (credentials) => fetchJson('/auth/login', jsonOptions('POST', credentials));
const getCurrentUser = (token) =>
  fetchJson('/users/token', {headers: {Authorization: `Bearer ${token}`}});
const updateUser = (data, token) => fetchJson('/users', jsonOptions('PUT', data, token));
const uploadAvatar = (file, token) => {
  const formData = new FormData();
  formData.append('avatar', file);
  return fetchJson('/users/avatar', {
    method: 'POST',
    headers: {Authorization: `Bearer ${token}`},
    body: formData,
  });
};

export {
  BASE_URL, getRestaurants, getDailyMenu, getWeeklyMenu,
  register, login, getCurrentUser, updateUser, uploadAvatar,
};
