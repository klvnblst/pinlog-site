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

  function allPositive(values) {
    return values.every(function (v) { return isFinite(v) && v > 0; });
  }

  function roundUnits(units) {
    return Math.round(units * 10 + 1e-9) / 10;
  }

  function roundTimes(times) {
    return Math.floor(times * 10 + 1e-9) / 10;
  }

  /** One product: vial content (mg), water added (mL) and the amount to convert (mg). */
  function convert(vialMg, waterMl, amountMg) {
    if (!(vialMg > 0) || !(waterMl > 0) || !(amountMg > 0)) return null;
    var concentration = vialMg / waterMl;
    // Fewest operations, so values that end in exactly ,x5 round up as on paper.
    var volumeMl = (amountMg * waterMl) / vialMg;
    var units = (amountMg * waterMl * 100) / vialMg;
    var timesInVial = vialMg / amountMg;
    if (!allPositive([concentration, volumeMl, units, timesInVial])) return null;
    return {
      concentration: concentration,
      volumeMl: volumeMl,
      units: roundUnits(units),
      timesInVial: roundTimes(timesInVial),
    };
  }

  /**
   * Several products dissolved together in ONE vial with ONE diluent.
   * The syringe draws all of them at once, in the vial's proportion, so only one dose can be chosen:
   * the dose of the reference product sets the volume, and every other amount follows from it.
   */
  function convertBlend(vialsMg, waterMl, refIndex, amountMg) {
    if (!vialsMg || !vialsMg.length || !(waterMl > 0) || !(amountMg > 0)) return null;
    if (!allPositive(vialsMg)) return null;
    var refMg = vialsMg[refIndex];
    if (!(refMg > 0)) return null;
    var volumeMl = (amountMg * waterMl) / refMg;
    var units = (amountMg * waterMl * 100) / refMg;
    var timesInVial = refMg / amountMg;
    var concentrations = vialsMg.map(function (mg) { return mg / waterMl; });
    var amounts = vialsMg.map(function (mg, i) { return i === refIndex ? amountMg : (amountMg * mg) / refMg; });
    var totalMg = vialsMg.reduce(function (sum, mg) { return sum + mg; }, 0);
    if (!allPositive([volumeMl, units, timesInVial, totalMg].concat(concentrations, amounts))) return null;
    return {
      volumeMl: volumeMl,
      units: roundUnits(units),
      concentrations: concentrations,
      amounts: amounts,
      totalMg: totalMg,
      timesInVial: roundTimes(timesInVial),
    };
  }

  /** The same math backwards: units read on the syringe -> volume and amount (mg). */
  function reverse(vialMg, waterMl, units) {
    if (!(vialMg > 0) || !(waterMl > 0) || !(units > 0)) return null;
    var concentration = vialMg / waterMl;
    var volumeMl = units / 100;
    var amountMg = volumeMl * concentration;
    if (!allPositive([concentration, volumeMl, amountMg])) return null;
    return { concentration: concentration, volumeMl: volumeMl, units: units, amountMg: amountMg };
  }

  function toMg(value, unit) {
    return unit === 'mcg' ? value / 1000 : value;
  }

  /** Graduation like a real insulin syringe: 1 mL marks every 2 units, smaller ones every unit. */
  function scaleMarks(maxUnits) {
    return maxUnits >= 100 ? { minor: 2, major: 10 } : { minor: 1, major: 5 };
  }

  var api = {
    scaleMarks: scaleMarks,
    convert: convert,
    convertBlend: convertBlend,
    reverse: reverse,
    parseDecimal: parseDecimal,
    toMg: toMg,
    SYRINGES: SYRINGES,
  };
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
  var field = {
    water: document.getElementById('cv-water'),
    waterHint: document.getElementById('cv-water-hint'),
    amount: document.getElementById('cv-amount'),
    unit: document.getElementById('cv-unit'),
    amountUnit: document.getElementById('cv-amount-unit'),
    amountHint: document.getElementById('cv-amount-hint'),
    amountBox: form.querySelector('.cv-amount-field'),
    unitsIn: document.getElementById('cv-units-in'),
    unitsInBox: form.querySelector('.cv-reverse-field'),
    refRow: document.getElementById('cv-ref-row'),
    ref: document.getElementById('cv-ref'),
  };
  var out = {
    card: document.getElementById('cv-result'),
    units: document.getElementById('cv-units'),
    bigLabel: document.getElementById('cv-big-label'),
    timesLabel: document.getElementById('cv-times-label'),
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
    labels: document.getElementById('cv-labels'),
    marker: document.getElementById('cv-marker'),
    markerPill: document.getElementById('cv-marker-pill'),
    markerText: document.getElementById('cv-marker-text'),
    caption: document.getElementById('cv-caption'),
    summaryLine: document.getElementById('cv-summary-line'),
    summaryRows: document.getElementById('cv-summary-rows'),
  };

  var HINTS = {
    water: {
      single: 'Quanto diluente (água bacteriostática, soro…) foi colocado no frasco.',
      blend: 'Um frasco só: o mesmo diluente dissolve todos os produtos da mistura.',
    },
    vial: {
      single: 'Quantos mg do ativo vêm no frasco.',
      blend: 'Quantos mg deste produto estão no frasco.',
    },
    amount: {
      single: 'Em mg ou mcg, escolha ao lado.',
      blend: 'Todos os produtos saem juntos na seringa. Informe a dose de um deles; o conversor mostra quanto vem dos outros.',
    },
  };

  var numberFormat = function (value, digits) {
    return value.toLocaleString('pt-BR', { maximumFractionDigits: digits, minimumFractionDigits: 0 });
  };
  var mg = function (v) { return numberFormat(v, 3) + ' mg'; };
  var withMcg = function (v) { return mg(v) + ' (' + numberFormat(v * 1000, 1) + ' mcg)'; };
  var unitsAndMl = function (units, ml) {
    return numberFormat(units, 1) + ' unidades (' + numberFormat(ml, 3) + ' mL)';
  };

  var counter = 0;
  var START = { water: '2', amount: '2,5', unitsIn: '50', vials: ['10', '5'] };

  function currentMode() {
    for (var i = 0; i < modeInputs.length; i++) if (modeInputs[i].checked) return modeInputs[i].value;
    return 'single';
  }

  function currentSyringe() {
    for (var i = 0; i < syringeInputs.length; i++) if (syringeInputs[i].checked) return syringeInputs[i].value;
    return 'U-50';
  }

  /** Display name: every insulin syringe is U-100; they differ only in capacity. */
  var SYRINGE_NAMES = { 'U-100': '1 mL (100 UI)', 'U-50': '0,5 mL (50 UI)', 'U-30': '0,3 mL (30 UI)' };
  function syringeName() {
    return 'seringa de insulina de ' + SYRINGE_NAMES[currentSyringe()];
  }

  /** Highlights the preset that matches the typed value, or opens "Outro" when none does. */
  function syncChips(scope) {
    scope.querySelectorAll('.cv-presets[data-field-for]').forEach(function (row) {
      var box = row.closest('.cv-field').querySelector('.cv-other-input');
      var input = box.querySelector('input');
      var typing = box.getAttribute('data-open') === 'true';
      var value = parseDecimal(input.value);
      var matched = false;
      row.querySelectorAll('[data-preset]').forEach(function (button) {
        var on = !typing && value > 0 && parseDecimal(button.getAttribute('data-preset')) === value;
        button.setAttribute('aria-pressed', String(on));
        if (on) matched = true;
      });
      row.querySelector('.cv-other').setAttribute('aria-pressed', String(!matched));
      box.hidden = matched;
    });
  }

  function addItem(vial) {
    if (list.children.length >= MAX_ITEMS) return null;
    counter += 1;
    var node = template.content.firstElementChild.cloneNode(true);
    var id = 'cv' + counter;
    node.setAttribute('data-id', id);
    node.querySelectorAll('[data-for]').forEach(function (label) {
      label.setAttribute('for', id + '-' + label.getAttribute('data-for'));
    });
    node.querySelectorAll('[data-field]').forEach(function (input) {
      input.id = id + '-' + input.getAttribute('data-field');
    });
    node.querySelector('[data-field="vial"]').value = vial || '';
    list.appendChild(node);
    syncChips(node);
    renumber();
    return node;
  }

  function itemName(item, index) {
    return item.querySelector('[data-field="name"]').value.trim() || 'Produto ' + (index + 1);
  }

  /** Keeps the "De qual produto" list in step with the products, preserving the choice. */
  function syncRefOptions() {
    var items = list.querySelectorAll('.cv-item');
    var selected = field.ref.value;
    while (field.ref.options.length > items.length) field.ref.remove(field.ref.options.length - 1);
    items.forEach(function (item, index) {
      var option = field.ref.options[index];
      if (!option) {
        option = document.createElement('option');
        field.ref.appendChild(option);
      }
      option.value = item.getAttribute('data-id');
      option.textContent = itemName(item, index);
    });
    field.ref.value = selected;
    if (field.ref.selectedIndex < 0) field.ref.selectedIndex = 0;
  }

  function renumber() {
    var mode = currentMode();
    var isBlend = mode === 'blend';
    var hintMode = isBlend ? 'blend' : 'single';
    var items = list.querySelectorAll('.cv-item');
    items.forEach(function (item, index) {
      item.querySelector('.cv-item-title').textContent = 'Produto ' + (index + 1);
      item.querySelector('[data-field="name"]').placeholder = 'Nome (opcional), ex.: Produto ' + String.fromCharCode(65 + index);
      item.querySelector('.cv-item-head').hidden = !isBlend;
      item.querySelector('.cv-remove').hidden = !isBlend || items.length <= 2;
      item.querySelector('.cv-name-row').hidden = !isBlend;
      item.querySelector('[data-vial-hint]').textContent = HINTS.vial[hintMode];
    });
    addButton.hidden = !isBlend || items.length >= MAX_ITEMS;
    field.waterHint.textContent = HINTS.water[hintMode];
    field.amountHint.textContent = HINTS.amount[hintMode];
    field.refRow.hidden = !isBlend;
    field.amountBox.hidden = mode === 'reverse';
    field.unitsInBox.hidden = mode !== 'reverse';
    syncRefOptions();
  }

  function setMode(mode) {
    var items = list.querySelectorAll('.cv-item');
    if (mode === 'blend' && items.length < 2) addItem(START.vials[1]);
    if (mode !== 'blend') {
      for (var i = items.length - 1; i >= 1; i--) items[i].remove();
    }
    form.setAttribute('data-mode', mode);
    renumber();
    update();
  }

  /** Marks a typed but unusable value as invalid; an empty field is just "not filled yet". */
  function check(input, value) {
    input.setAttribute('aria-invalid', input.value.trim() !== '' && !(value > 0) ? 'true' : 'false');
    return value;
  }

  function readForm() {
    var mode = currentMode();
    var items = Array.prototype.map.call(list.querySelectorAll('.cv-item'), function (item, index) {
      return {
        id: item.getAttribute('data-id'),
        name: itemName(item, index),
        vial: check(item.querySelector('[data-field="vial"]'), parseDecimal(item.querySelector('[data-field="vial"]').value)),
      };
    });
    var data = {
      mode: mode,
      items: items,
      water: check(field.water, parseDecimal(field.water.value)),
      refIndex: Math.max(0, field.ref.selectedIndex),
    };
    if (mode === 'reverse') {
      data.unitsIn = check(field.unitsIn, parseDecimal(field.unitsIn.value));
      data.result = reverse(items[0].vial, data.water, data.unitsIn);
    } else {
      data.amount = toMg(check(field.amount, parseDecimal(field.amount.value)), field.unit.value);
      data.result = mode === 'blend'
        ? convertBlend(items.map(function (i) { return i.vial; }), data.water, data.refIndex, data.amount)
        : convert(items[0].vial, data.water, data.amount);
    }
    return data;
  }

  // Syringe drawing (SVG user units): the barrel spans 22–304, the scale sits inside it.
  var BARREL_X = 22;
  var SCALE_X0 = 36;
  var SCALE_X1 = 290;
  var VIEW_W = 340;

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  /** Draws the graduated scale, lights it up to the value and points the label at it. */
  function drawSyringe(units, maxUnits) {
    var value = Math.max(0, units || 0);
    var shown = Math.min(value, maxUnits);
    var marks = scaleMarks(maxUnits);
    var xAt = function (u) { return SCALE_X0 + (u / maxUnits) * (SCALE_X1 - SCALE_X0); };
    var ticks = '';
    var labels = '';
    for (var u = 0; u <= maxUnits; u += marks.minor) {
      var x = round1(xAt(u));
      var major = u % marks.major === 0;
      var on = value > 0 && u <= value + 1e-9 ? ' is-on' : '';
      ticks += '<line class="' + (major ? 'is-major' : '') + on + '" x1="' + x + '" x2="' + x + '" y1="' +
        (major ? 34 : 41) + '" y2="' + (major ? 64 : 57) + '" />';
      if (major) labels += '<text class="' + on + '" x="' + x + '" y="17" text-anchor="middle">' + u + '</text>';
    }
    out.ticks.innerHTML = ticks;
    out.labels.innerHTML = labels;
    out.fill.setAttribute('width', value > 0 ? String(round1(xAt(shown) - BARREL_X)) : '0');

    // SVG elements have no .hidden property: toggle the attribute itself.
    if (value > 0) out.marker.removeAttribute('hidden'); else out.marker.setAttribute('hidden', '');
    if (!(value > 0)) return;
    var mx = xAt(shown);
    out.markerText.textContent = numberFormat(value, 1) + (value === 1 ? ' unidade' : ' unidades');
    var textWidth = 0;
    try { textWidth = out.markerText.getComputedTextLength(); } catch (e) { /* not rendered yet */ }
    var width = Math.ceil((textWidth || out.markerText.textContent.length * 7.4) + 26);
    // Keep the label inside the drawing near both ends; the dotted line still points at the value.
    var left = Math.max(2, Math.min(mx - width / 2, VIEW_W - 2 - width));
    out.markerPill.setAttribute('x', String(round1(left - mx)));
    out.markerPill.setAttribute('width', String(width));
    out.markerText.setAttribute('x', String(round1(left - mx + width / 2)));
    out.marker.style.transform = 'translateX(' + round1(mx) + 'px)';
  }

  function listJoin(parts) {
    if (parts.length <= 1) return parts.join('');
    return parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1];
  }

  function renderSummary(data) {
    out.summaryRows.innerHTML = '';
    var r = data.result;
    if (!r) {
      out.summaryLine.textContent = 'Preencha os campos para ver o resumo.';
      return;
    }
    var syringe = 'Insulina, ' + SYRINGE_NAMES[currentSyringe()];
    var first = data.items[0];
    var rows;
    if (data.mode === 'reverse') {
      out.summaryLine.textContent = numberFormat(data.unitsIn, 1) + ' unidades numa ' + syringeName() +
        ' correspondem a ' + withMcg(r.amountMg) + '.';
      rows = [
        ['Diluente adicionado', numberFormat(data.water, 3) + ' mL'],
        ['Conteúdo do frasco', mg(first.vial)],
        ['Concentração', numberFormat(r.concentration, 3) + ' mg/mL'],
        ['Marcação na seringa', numberFormat(data.unitsIn, 1) + ' unidades'],
        ['Volume', numberFormat(r.volumeMl, 3) + ' mL'],
        ['Quantidade', withMcg(r.amountMg)],
        ['Seringa', syringe],
      ];
    } else if (data.mode === 'blend') {
      var ref = data.items[data.refIndex];
      var others = [];
      data.items.forEach(function (item, i) {
        if (i !== data.refIndex) others.push(mg(r.amounts[i]) + ' de ' + item.name);
      });
      out.summaryLine.textContent = withMcg(data.amount) + ' de ' + ref.name + ' correspondem a ' +
        unitsAndMl(r.units, r.volumeMl) + ' numa ' + syringeName() + '. Nesse mesmo volume vão também ' +
        listJoin(others) + '.';
      rows = [['Diluente adicionado', numberFormat(data.water, 3) + ' mL para todo o frasco']];
      data.items.forEach(function (item, i) {
        rows.push([item.name, mg(item.vial) + ' no frasco → ' + mg(r.amounts[i]) + ' na seringa']);
      });
      rows.push(['Total no frasco', mg(r.totalMg)]);
      rows.push(['Na seringa', unitsAndMl(r.units, r.volumeMl), true]);
      rows.push(['Seringa', syringe]);
      rows.push(['O frasco rende', '~' + numberFormat(r.timesInVial, 1) + ' vezes (todos os produtos acabam juntos)']);
    } else {
      out.summaryLine.textContent = withMcg(data.amount) + ' correspondem a ' + unitsAndMl(r.units, r.volumeMl) +
        ' numa ' + syringeName() + '.';
      rows = [
        ['Diluente adicionado', numberFormat(data.water, 3) + ' mL'],
        ['Conteúdo do frasco', mg(first.vial)],
        ['Concentração', numberFormat(r.concentration, 3) + ' mg/mL'],
        ['Dose desejada', withMcg(data.amount)],
        ['Na seringa', unitsAndMl(r.units, r.volumeMl), true],
        ['Seringa', syringe],
        ['O frasco rende', '~' + numberFormat(r.timesInVial, 1) + ' vezes'],
      ];
    }
    rows.forEach(function (row) {
      var tr = document.createElement('tr');
      if (row[2]) tr.className = 'cv-summary-total';
      var th = document.createElement('th');
      th.scope = 'row';
      th.textContent = row[0];
      var td = document.createElement('td');
      td.textContent = row[1];
      tr.appendChild(th);
      tr.appendChild(td);
      out.summaryRows.appendChild(tr);
    });
  }

  function renderParts(data) {
    out.parts.innerHTML = '';
    if (data.mode !== 'blend' || !data.result) return;
    data.items.forEach(function (item, i) {
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.textContent = item.name;
      var value = document.createElement('strong');
      value.textContent = mg(data.result.amounts[i]);
      li.appendChild(name);
      li.appendChild(value);
      out.parts.appendChild(li);
    });
  }

  function update() {
    syncRefOptions();
    var spec = SYRINGES[currentSyringe()];
    var data = readForm();
    var r = data.result;
    var isReverse = data.mode === 'reverse';
    var isBlend = data.mode === 'blend';

    out.card.setAttribute('data-state', r ? 'ok' : 'empty');
    out.empty.hidden = !!r;
    renderParts(data);
    renderSummary(data);

    if (!r) {
      out.units.textContent = '–';
      out.volume.textContent = '–';
      out.concentration.textContent = '–';
      out.times.textContent = '–';
      out.warning.hidden = true;
      out.caption.textContent = 'Preencha os campos para ver a conversão.';
      drawSyringe(0, spec.maxUnits);
      return;
    }

    var units = r.units;
    out.concRow.hidden = isBlend;
    out.timesRow.hidden = false;
    out.volume.textContent = numberFormat(r.volumeMl, 3) + ' mL';
    if (isReverse) {
      out.units.textContent = numberFormat(r.amountMg, 3);
      out.bigLabel.textContent = 'mg nessa marcação';
      out.concentration.textContent = numberFormat(r.concentration, 3) + ' mg/mL';
      out.timesLabel.textContent = 'Em mcg';
      out.times.textContent = numberFormat(r.amountMg * 1000, 1) + ' mcg';
    } else {
      out.units.textContent = numberFormat(units, 1);
      out.bigLabel.textContent = 'unidades na seringa';
      out.timesLabel.textContent = 'O frasco rende';
      out.times.textContent = '~' + numberFormat(r.timesInVial, 1) + ' vezes';
      if (!isBlend) out.concentration.textContent = numberFormat(r.concentration, 3) + ' mg/mL';
    }

    var warnings = [];
    if (!isReverse && r.timesInVial < 1) {
      warnings.push('A dose passa do conteúdo do frasco (' + mg(data.items[isBlend ? data.refIndex : 0].vial) + ').');
    }
    if (units > spec.maxUnits) {
      warnings.push('O volume passa da capacidade desta seringa (' + spec.maxUnits + ' unidades, ' +
        numberFormat(spec.maxMl, 1) + ' mL).');
    }
    out.warning.hidden = !warnings.length;
    if (warnings.length) out.warning.textContent = warnings.join(' ') + ' Confira os valores digitados.';

    out.caption.textContent = numberFormat(units, 1) + ' de ' + spec.maxUnits + ' unidades (' + syringeName() + ').';
    drawSyringe(units, spec.maxUnits);
  }

  form.addEventListener('input', update);
  form.addEventListener('change', function (event) {
    if (event.target === field.unit) field.amountUnit.textContent = field.unit.value;
    update();
  });
  form.addEventListener('click', function (event) {
    var preset = event.target.closest('[data-preset]');
    if (preset) {
      var presetField = preset.closest('.cv-field');
      var box = presetField.querySelector('.cv-other-input');
      box.querySelector('input').value = preset.getAttribute('data-preset');
      box.setAttribute('data-open', 'false');
      syncChips(presetField);
      update();
      return;
    }
    var other = event.target.closest('.cv-other');
    if (other) {
      var otherField = other.closest('.cv-field');
      var otherBox = otherField.querySelector('.cv-other-input');
      otherBox.setAttribute('data-open', 'true');
      syncChips(otherField);
      otherBox.querySelector('input').focus();
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
    var node = addItem('5');
    update();
    if (node) node.querySelector('[data-field="name"]').focus();
  });

  function start() {
    list.innerHTML = '';
    field.water.value = START.water;
    field.water.closest('.cv-other-input').setAttribute('data-open', 'false');
    syncChips(field.water.closest('.cv-field'));
    field.amount.value = START.amount;
    field.unit.value = 'mg';
    field.amountUnit.textContent = 'mg';
    field.unitsIn.value = START.unitsIn;
    addItem(START.vials[0]);
    if (currentMode() === 'blend') addItem(START.vials[1]);
    field.ref.selectedIndex = 0;
  }

  resetButton.addEventListener('click', function () {
    start();
    setMode(currentMode());
  });
  modeInputs.forEach(function (input) {
    input.addEventListener('change', function () { setMode(currentMode()); });
  });
  form.addEventListener('submit', function (event) { event.preventDefault(); });

  start();
  setMode(currentMode());
})(this);
