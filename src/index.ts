// src/index.ts
//
// Global entry used by Webpack. It detects which HTML page we’re on
// and calls the page-specific bootstrap code.

import { bootChartPage } from "./pages/chart";

// Simple router based on current pathname
function main() {
  const path = window.location.pathname;

  if (path.endsWith("/chart.html") || path === "/chart") {
    bootChartPage();
    return;
  }

  // You can add more pages later, e.g. /index.html, /account.html, etc.
}

document.addEventListener("DOMContentLoaded", main);
