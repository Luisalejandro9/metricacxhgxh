/**
 * @file useTheme.js
 * @description Hook personalizado para gestionar el tema visual (oscuro/claro) de la aplicación.
 * Persiste la preferencia en `localStorage` y actualiza los atributos y clases en `document.documentElement`.
 */

import { useState, useEffect } from 'react';

/**
 * Administra el estado del tema actual y expone utilidades para cambiarlo o alternarlo.
 */
export function useTheme() {
  // --- Inicialización del tema desde localStorage ---
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('app_theme');
    if (saved === 'light' || saved === 'dark') {
      return saved;
    }
    // Usar modo oscuro por defecto según preferencia del proyecto
    return 'dark';
  });

  // --- Sincronización del tema con el DOM y almacenamiento local ---
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    document.documentElement.classList.add(`theme-${theme}`);
    localStorage.setItem('app_theme', theme);
  }, [theme]);

  // Alterna entre modo oscuro y modo claro
  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, setTheme, toggleTheme };
}
