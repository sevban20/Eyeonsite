import axios from 'axios';

const api = axios.create({
  baseURL: '/api'
});

api.interceptors.request.use((config) => {
  // Cagiranin acikca verdigi Authorization basligi EZILMEZ. Onceden kosulsuz
  // uzerine yaziliyordu: durum sayfasi kilidi acildiktan sonra yapilan istek,
  // sayfanin erisim jetonu yerine oturum jetonuyla gidiyordu ve sunucu haklı
  // olarak reddediyordu — yani ozellik tam da giris yapmis kullanicida,
  // ozelligi test eden kisinin tarayicisinda bozuktu.
  if (config.headers.Authorization) return config;

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
