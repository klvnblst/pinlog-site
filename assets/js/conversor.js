/*
 * PinLog — conversor de unidades (mg → mL → unidades da seringa).
 * Só faz contas com os valores digitados. Nada é salvo nem enviado: tudo roda no navegador.
 * The math mirrors the old in-app converter: units = (amount / (vial / water)) * 100.
 */
(function (root) {
  'use strict';

  var SYRINGES = {
    'U-100': { maxUnits: 100, maxMl: 1 },
    'U-50': { maxUnits: 50, maxMl: 0.5 },
    'U-30': { maxUnits: 30, maxMl: 0.3 },
  };
  var MAX_ITEMS = 6;

  /** Strict decimal parser that accepts "," or "."; anything else returns 0. */
  function parseDecimal(text) {
    var normalized = String(text == null ? '' : text).trim().replace(',', '.');
    if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return 0;
    var value = Number(normalized);
    return isFinite(value) ? value : 0;
  }

  /** One product: vial content (mg), water added (mL) and the amount to convert (mg). */
  function convert(vialMg, waterMl, amountMg) {
    if (!(vialMg > 0) || !(waterMl > 0) || !(amountMg > 0)) return null;
    var concentration = vialMg / waterMl;
    var volumeMl = amountMg / concentration;
    var units = volumeMl * 100;
    var timesInVial = vialMg / amountMg;
    if (![concentration, volumeMl, units, timesInVial].every(function (v) { return isFinite(v) && v > 0; })) {
      return null;
    }
    return {
      concentration: concentration,
      volumeMl: volumeMl,
      units: Math.round(units * 10) / 10,
      timesInVial: Math.floor(timesInVial * 10) / 10,
    };
  }

  function toMg(value, unit) {
    return unit === 'mcg' ? value / 1000 : value;
  }

  var api = { convert: convert, parseDecimal: parseDecimal, toMg: toMg, SYRINGES: SYRINGES };
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  /* ---------- Page ---------- */

  var form = document.getElementById('conversor');
  if (!form) return;

  var list = document.getElementById('cv-items');
  var template = document.getElementById('cv-item-template');
  var addButton = document.getElementById('cv-add');
  var resetButton = document.getElementById('cv-reset');
  var modeInputs = form.querySelectorAll('input[name="cv-mode"]');
  var syringeInputs = form.querySelectorAll('input[name="cv-syringe"]');
  var out = {
    card: document.getElementById('cv-result'),
    units: document.getElementById('cv-units'),
    volume: document.getElementById('cv-volume'),
    concentration: document.getElementById('cv-concentration'),
    times: document.getElementById('cv-times'),
    timesRow: document.getElementById('cv-times-row'),
    concRow: document.getElementById('cv-conc-row'),
    parts: document.getElementById('cv-parts'),
    warning: document.getElementById('cv-warning'),
    empty: document.getElementById('cv-empty'),
    fill: document.getElementById('cv-fill'),
    ticks: document.getElementById('cv-ticks'),
    scaleMax: document.getElementById('cv-scale-max'),
    caption: document.getElementById('cv-caption'),
  };

  var numberFormat = function (value, digits) {
    return value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  };

  var counter = 0;
  var DEFAULTS = [
    { vial: '10', water: '2', amount: '2,5' },
    { vial: '5', water: '1', amount: '1' },
  ];

  function currentMode() {
    for (var i = 0; i < modeInputs.length; i++) if (modeInputs[i].checked) return modeInputs[i].value;
    return 'single';
  }

  function currentSyringe() {
    for (var i = 0; i < syringeInputs.length; i++) if (syringeInputs[i].checked) return syringeInputs[i].value;
    return 'U-100';
  }

  function addItem(values) {
    if (list.children.length >= MAX_ITEMS) return;
    counter += 1;
    var node = template.content.firstElementChild.cloneNode(true);
    var id = 'cv' + counter;
    node.querySelectorAll('[data-for]').forEach(function (label) {
      label.setAttribute('for', id + '-' + label.getAttribute('data-for'));
    });
    node.querySelectorAll('[data-field]').forEach(function (input) {
      input.id = id + '-' + input.getAttribute('data-field');
    });
    var unitSelect = node.querySelector('[data-field="unit"]');
    unitSelect.setAttribute('aria-label', 'Unidade da quantidade');
    if (values) {
      node.querySelector('[data-field="vial"]').value = values.vial;
      node.querySelector('[data-field="water"]').value = values.water;
      node.querySelector('[data-field="amount"]').value = values.amount;
    }
    list.appendChild(node);
    renumber();
  }

  function renumber() {
    var items = list.querySelectorAll('.cv-item');
    items.forEach(function (item, index) {
      item.querySelector('.cv-item-title').textContent = 'Produto ' + (index + 1);
      var nameInput = item.querySelector('[data-field="name"]');
      nameInput.placeholder = 'Nome (opcional), ex.: Produto ' + String.fromCharCode(65 + index);
    });
    var isBlend = currentMode() === 'blend';
    addButton.hidden = !isBlend || items.length >= MAX_ITEMS;
    items.forEach(function (item) {
      item.querySelector('.cv-remove').hidden = !isBlend || items.length <= 2;
      item.querySelector('.cv-name-row').hidden = !isBlend;
    });
  }

  function setMode(mode) {
    var items = list.querySelectorAll('.cv-item');
    if (mode === 'blend' && items.length < 2) addItem(DEFAULTS[1]);
    if (mode === 'single') {
      for (var i = items.length - 1; i >= 1; i--) items[i].remove();
    }
    form.setAttribute('data-mode', mode);
    renumber();
    update();
  }

  function readItems() {
    return Array.prototype.map.call(list.querySelectorAll('.cv-item'), function (item, index) {
      var get = function (field) {
        return item.querySelector('[data-field="' + field + '"]');
      };
      var vial = parseDecimal(get('vial').value);
      var water = parseDecimal(get('water').value);
      var amount = toMg(parseDecimal(get('amount').value), get('unit').value);
      [['vial', vial], ['water', water], ['amount', amount]].forEach(function (pair) {
        var input = get(pair[0]);
        var invalid = input.value.trim() !== '' && !(pair[1] > 0);
        input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
      });
      var name = get('name').value.trim() || 'Produto ' + (index + 1);
      return { name: name, result: convert(vial, water, amount) };
    });
  }

  function drawSyringe(units, maxUnits) {
    var ratio = Math.max(0, Math.min(units / maxUnits, 1));
    out.fill.setAttribute('width', String(Math.round(ratio * 260 * 10) / 10));
    out.scaleMax.textContent = String(maxUnits);
    var step = maxUnits === 100 ? 10 : maxUnits === 50 ? 5 : 5;
    var ticks = '';
    for (var u = 0; u <= maxUnits; u += step) {
      var x = 20 + (u / maxUnits) * 260;
      var major = u % (step * 2) === 0;
      ticks += '<line x1="' + x + '" x2="' + x + '" y1="' + (major ? 22 : 28) + '" y2="40" />';
    }
    out.ticks.innerHTML = ticks;
  }

  function update() {
    var spec = SYRINGES[currentSyringe()];
    var items = readItems();
    var isBlend = currentMode() === 'blend';
    var valid = items.every(function (item) { return item.result; });

    out.card.setAttribute('data-state', valid ? 'ok' : 'empty');
    out.empty.hidden = valid;

    if (!valid) {
      out.units.textContent = '–';
      out.volume.textContent = '–';
      out.concentration.textContent = '–';
      out.times.textContent = '–';
      out.parts.innerHTML = '';
      out.warning.hidden = true;
      out.caption.textContent = 'Preencha os campos para ver a conversão.';
      drawSyringe(0, spec.maxUnits);
      return;
    }

    var totalUnits = Math.round(items.reduce(function (sum, i) { return sum + i.result.units; }, 0) * 10) / 10;
    var totalMl = items.reduce(function (sum, i) { return sum + i.result.volumeMl; }, 0);

    out.units.textContent = numberFormat(totalUnits, 1);
    out.volume.textContent = numberFormat(totalMl, 3) + ' mL';
    out.concRow.hidden = isBlend;
    out.timesRow.hidden = isBlend;
    if (!isBlend) {
      out.concentration.textContent = numberFormat(items[0].result.concentration, 3) + ' mg/mL';
      out.times.textContent = '~' + numberFormat(items[0].result.timesInVial, 1) + ' vezes';
    }

    out.parts.innerHTML = '';
    if (isBlend) {
      items.forEach(function (item) {
        var li = document.createElement('li');
        var name = document.createElement('span');
        name.textContent = item.name;
        var value = document.createElement('strong');
        value.textContent =
          numberFormat(item.result.units, 1) + ' unid. · ' + numberFormat(item.result.volumeMl, 3) + ' mL';
        li.appendChild(name);
        li.appendChild(value);
        out.parts.appendChild(li);
      });
    }

    var exceeded = totalUnits > spec.maxUnits;
    out.warning.hidden = !exceeded;
    if (exceeded) {
      out.warning.textContent =
        'O volume passa da capacidade desta seringa (' + spec.maxUnits + ' unidades, ' +
        numberFormat(spec.maxMl, 1) + ' mL). Confira os valores digitados.';
    }
    out.caption.textContent =
      numberFormat(totalUnits, 1) + ' de ' + spec.maxUnits + ' unidades numa seringa ' + currentSyringe() + '.';
    drawSyringe(totalUnits, spec.maxUnits);
  }

  list.addEventListener('input', update);
  list.addEventListener('change', update);
  list.addEventListener('click', function (event) {
    var preset = event.target.closest('[data-preset]');
    if (preset) {
      var item = preset.closest('.cv-item');
      var input = item.querySelector('[data-field="' + preset.getAttribute('data-target') + '"]');
      input.value = preset.getAttribute('data-preset');
      update();
      return;
    }
    var remove = event.target.closest('.cv-remove');
    if (remove) {
      remove.closest('.cv-item').remove();
      renumber();
      update();
    }
  });
  addButton.addEventListener('click', function () {
    addItem({ vial: '5', water: '1', amount: '1' });
    update();
    var items = list.querySelectorAll('.cv-item');
    items[items.length - 1].querySelector('[data-field="name"]').focus();
  });
  resetButton.addEventListener('click', function () {
    list.innerHTML = '';
    addItem(DEFAULTS[0]);
    if (currentMode() === 'blend') addItem(DEFAULTS[1]);
    renumber();
    update();
  });
  modeInputs.forEach(function (input) {
    input.addEventListener('change', function () { setMode(currentMode()); });
  });
  syringeInputs.forEach(function (input) {
    input.addEventListener('change', update);
  });
  form.addEventListener('submit', function (event) { event.preventDefault(); });

  addItem(DEFAULTS[0]);
  setMode(currentMode());
})(this);
