// manifest.js: fills the compiled-asset table from the same data the hero renders.
import { PATCHES, COLORS } from './bike.js';

const ROLE = {
  CONTACT: 'load-bearing contact',
  GRIP: 'graspable surface',
  SUPPORT: 'seating surface',
  ROTATION: 'rotation axis',
  HINGE: 'steering axis',
};
const tbody = document.querySelector('.manifest tbody');
if (tbody) {
  for (const p of PATCHES) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td class="m-id">${p.id}</td><td class="m-kind" style="--c:${COLORS[p.kind]}">${p.kind}</td><td>${ROLE[p.kind]}</td><td class="m-joint">${p.joint}</td>`;
    tbody.appendChild(tr);
  }
  document.querySelector('.manifest-count').textContent = String(PATCHES.length);
}
