import { useEffect, useState } from "react";

/* One ticking clock for the shell's chrome (top bars, widgets, dock). */
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const MONS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function pad(n) {
  return (n < 10 ? "0" : "") + n;
}
export function hm(d) {
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}
export function hms(d) {
  return hm(d) + ":" + pad(d.getSeconds());
}
export function fullDate(d) {
  return DAYS[d.getDay()] + " · " + d.getDate() + " " + MONS[d.getMonth()] + " " + d.getFullYear();
}
