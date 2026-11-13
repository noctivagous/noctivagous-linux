/**
 * Panel controls (sliders, toggles, buttons, selects) take DOM focus on
 * pointerdown. Paint shortcuts then land on that control instead of the
 * stage. This returns focus to the marked stage after the control handles
 * the click, and keeps text fields focused so names can still be typed.
 */

export const NCT_STAGE_ATTR = 'data-nct-stage';

const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'radio', 'range', 'color', 'file', 'submit', 'reset', 'image',
]);

/** True when the control is a place the user is typing, not a panel widget. */
export function isTextEntryControl(tagName: string, type = '', contentEditable = false): boolean {
  const tag = tagName.toLowerCase();
  if (contentEditable) return true;
  if (tag === 'textarea' || tag === 'select') return true;
  if (tag === 'input') return !NON_TEXT_INPUT_TYPES.has((type || 'text').toLowerCase());
  return false;
}

export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return isTextEntryControl(target.tagName, target instanceof HTMLInputElement ? target.type : '', target.isContentEditable);
}

function stageElement(root: ParentNode): HTMLElement | null {
  const stage = root.querySelector(`[${NCT_STAGE_ATTR}]`);
  return stage instanceof HTMLElement ? stage : null;
}

export function focusStage(root: ParentNode): void {
  const stage = stageElement(root);
  if (stage) {
    if (document.activeElement !== stage) stage.focus({ preventScroll: true });
    return;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement && root instanceof Node && root.contains(active) && !isTextEntryTarget(active)) {
    active.blur();
  }
}

const BUTTON_SELECTOR = 'button, a, [role="button"], [role="switch"], summary';

/**
 * While pointer interaction is inside `root`, non-text controls do not keep
 * focus. Buttons never take it (mousedown default is canceled; click still
 * fires). Sliders, checkboxes, and selects run their default action, then
 * focus returns to `[data-nct-stage]` on mouseup. A select's opening click
 * is left alone so the menu stays open; choosing an option or pressing
 * Escape returns focus.
 */
export function bindStageFocus(root: HTMLElement): () => void {
  let restoreArmed = false;
  let skipNextUp = false;

  const onMouseDown = (e: MouseEvent) => {
    if (!(e.target instanceof Element) || !root.contains(e.target)) return;
    if (isTextEntryTarget(e.target)) {
      restoreArmed = false;
      skipNextUp = false;
      return;
    }
    restoreArmed = true;
    const select = e.target.closest('select');
    if (select && document.activeElement !== select) {
      skipNextUp = true;
    }
    if (e.button !== 0) return;
    const button = e.target.closest(BUTTON_SELECTOR);
    if (button && root.contains(button)) e.preventDefault();
  };

  const restore = () => {
    const active = document.activeElement;
    if (active instanceof HTMLSelectElement && root.contains(active)) return;
    focusStage(root);
  };

  const onMouseUp = () => {
    if (!restoreArmed) return;
    if (skipNextUp) {
      skipNextUp = false;
      restoreArmed = false;
      return;
    }
    restoreArmed = false;
    requestAnimationFrame(restore);
  };

  const onChange = (e: Event) => {
    const t = e.target;
    if (!(t instanceof HTMLSelectElement || (t instanceof HTMLInputElement && (t.type === 'checkbox' || t.type === 'radio' || t.type === 'file' || t.type === 'color')))) return;
    if (!root.contains(t)) return;
    restoreArmed = false;
    skipNextUp = false;
    requestAnimationFrame(() => focusStage(root));
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (!(document.activeElement instanceof HTMLSelectElement) || !root.contains(document.activeElement)) return;
    restoreArmed = false;
    requestAnimationFrame(() => focusStage(root));
  };

  root.addEventListener('mousedown', onMouseDown, true);
  window.addEventListener('mouseup', onMouseUp, true);
  root.addEventListener('change', onChange, true);
  window.addEventListener('keydown', onKeyDown, true);
  focusStage(root);

  return () => {
    root.removeEventListener('mousedown', onMouseDown, true);
    window.removeEventListener('mouseup', onMouseUp, true);
    root.removeEventListener('change', onChange, true);
    window.removeEventListener('keydown', onKeyDown, true);
  };
}
