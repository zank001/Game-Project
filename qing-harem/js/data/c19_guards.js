/* c19_guards.js — integration guards applied AFTER all content has loaded (lead-owned).
   1) Exit offers (of_* chapters): only ONE exit-offer chain per playthrough. Entry chapters (those whose trigger does not
      mention F.of_) are blocked once any offer has started, and set F.of_any when they start. */
(function () {
  Q.events.forEach(function (ev) {
    if (ev.kind !== 'chapter' || ev.id.indexOf('of_') !== 0 || !ev.trigger) return;
    if (ev.trigger.indexOf('F.of_') >= 0) return;            // continuation chapters keep their own gating
    if (ev.trigger.indexOf('F.of_any') < 0) ev.trigger = '(' + ev.trigger + ') && !F.of_any';
    var n = ev.nodes && ev.nodes[ev.start];
    if (!n) return;
    n.fx = n.fx || {};
    if (Array.isArray(n.fx.set)) { if (n.fx.set.indexOf('of_any') < 0) n.fx.set.push('of_any'); }
    else { n.fx.set = n.fx.set || {}; n.fx.set.of_any = true; }
  });
})();
