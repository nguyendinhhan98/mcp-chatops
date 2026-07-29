/**
 * Vanilla JS Drag-and-Drop Engine for Kanban Board
 * Supports mouse, touch, and keyboard (Ctrl+Arrow) navigation
 */

export class DragDropEngine {
  constructor({ onDrop, onDragStart, onDragEnd, containerSelector, cardSelector, columnSelector }) {
    this.onDrop = onDrop;
    this.onDragStart = onDragStart;
    this.onDragEnd = onDragEnd;
    this.containerSelector = containerSelector || '.kanban-board';
    this.cardSelector = cardSelector || '.kanban-card';
    this.columnSelector = columnSelector || '.kanban-column-body';

    this.dragEl = null;
    this.ghost = null;
    this.placeholder = null;
    this.startColumn = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.lastOver = null;

    // Pre-bind listener methods to store references for proper removal on destroy
    this._handleMouseDown = (e) => this._onPointerDown(e, 'mouse');
    this._handleMouseMove = (e) => this._onPointerMove(e, 'mouse');
    this._handleMouseUp = (e) => this._onPointerUp(e, 'mouse');

    this._handleTouchStart = (e) => this._onPointerDown(e, 'touch');
    this._handleTouchMove = (e) => this._onPointerMove(e, 'touch');
    this._handleTouchEnd = (e) => this._onPointerUp(e, 'touch');

    this._handleKeyDown = (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const focused = document.activeElement;
      if (!focused || !focused.closest(this.cardSelector)) return;
      const card = focused.closest(this.cardSelector);
      if (!card) return;

      const columns = Array.from(document.querySelectorAll(this.columnSelector));
      const currentCol = card.closest(this.columnSelector);
      const colIdx = columns.indexOf(currentCol);

      if (e.key === 'ArrowRight' && colIdx < columns.length - 1) {
        e.preventDefault();
        this._moveCardToColumn(card, columns[colIdx + 1]);
      } else if (e.key === 'ArrowLeft' && colIdx > 0) {
        e.preventDefault();
        this._moveCardToColumn(card, columns[colIdx - 1]);
      }
    };

    this._bindMouse();
    this._bindTouch();
    this._bindKeyboard();
  }

  // ─── Mouse Events ──────────────────────────────────────────────────────────

  _bindMouse() {
    document.addEventListener('mousedown', this._handleMouseDown);
    document.addEventListener('mousemove', this._handleMouseMove);
    document.addEventListener('mouseup', this._handleMouseUp);
  }

  // ─── Touch Events ──────────────────────────────────────────────────────────

  _bindTouch() {
    document.addEventListener('touchstart', this._handleTouchStart, { passive: false });
    document.addEventListener('touchmove', this._handleTouchMove, { passive: false });
    document.addEventListener('touchend', this._handleTouchEnd);
  }

  // ─── Keyboard Accessibility ─────────────────────────────────────────────────

  _bindKeyboard() {
    document.addEventListener('keydown', this._handleKeyDown);
  }

  _moveCardToColumn(card, targetColumn) {
    const fromColumn = card.closest(this.columnSelector);
    if (!fromColumn || fromColumn === targetColumn) return;
    targetColumn.appendChild(card);
    card.focus();
    if (this.onDrop) {
      this.onDrop({
        cardId: card.dataset.cardId,
        fromLaneId: fromColumn.dataset.laneId,
        toLaneId: targetColumn.dataset.laneId,
      });
    }
  }

  // ─── Pointer Down ───────────────────────────────────────────────────────────

  _onPointerDown(e, type) {
    const point = type === 'touch' ? e.touches[0] : e;
    const handle = point.target.closest('.card-drag-handle') || point.target.closest(this.cardSelector);
    if (!handle) return;
    // Ignore clicks on interactive elements
    if (point.target.closest('button, a, input, textarea, select, [contenteditable]')) return;

    const card = handle.closest(this.cardSelector);
    if (!card) return;

    if (type === 'touch') e.preventDefault();

    this.dragEl = card;
    this.startColumn = card.closest(this.columnSelector);
    const rect = card.getBoundingClientRect();
    this.offsetX = point.clientX - rect.left;
    this.offsetY = point.clientY - rect.top;

    // Delay ghost creation slightly to allow click events on non-dragged cards
    this._dragTimeout = setTimeout(() => {
      this._startDrag(card, point);
    }, 120);
  }

  _startDrag(card, point) {
    // Create ghost element
    this.ghost = card.cloneNode(true);
    this.ghost.classList.remove('dragging');
    this.ghost.classList.add('drag-ghost');

    // Trigger drag start on the original card (which hides it)
    if (this.onDragStart) this.onDragStart(card);
    this.ghost.style.cssText = `
      position: fixed;
      width: ${card.offsetWidth}px;
      left: ${point.clientX - this.offsetX}px;
      top: ${point.clientY - this.offsetY}px;
      z-index: 9999;
      pointer-events: none;
      opacity: 0.95;
      transform: rotate(1.5deg) scale(1.02);
      transition: transform 0.1s ease;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
    `;
    document.body.appendChild(this.ghost);

    // Create placeholder
    this.placeholder = document.createElement('div');
    this.placeholder.className = 'drag-placeholder';
    this.placeholder.style.cssText = `
      height: ${card.offsetHeight}px;
      margin: 4px 0;
      border-radius: 10px;
      border: 2px dashed rgba(124, 58, 237, 0.5);
      background: rgba(124, 58, 237, 0.05);
      transition: all 0.2s ease;
      pointer-events: none;
    `;
    card.parentNode.insertBefore(this.placeholder, card);
    card.style.display = 'none';
  }

  // ─── Pointer Move ───────────────────────────────────────────────────────────

  _onPointerMove(e, type) {
    if (!this.dragEl) return;
    if (!this.ghost) return;

    const point = type === 'touch' ? e.touches[0] : e;
    if (type === 'touch') e.preventDefault();

    // Move ghost
    this.ghost.style.left = `${point.clientX - this.offsetX}px`;
    this.ghost.style.top = `${point.clientY - this.offsetY}px`;

    // Find column under pointer (excluding ghost)
    this.ghost.style.pointerEvents = 'none';
    const elemBelow = document.elementFromPoint(point.clientX, point.clientY);
    this.ghost.style.pointerEvents = 'none';

    if (!elemBelow) return;
    const col = elemBelow.closest(this.columnSelector);

    if (col && col !== this.lastOver) {
      col.classList.add('drag-over');
      if (this.lastOver) this.lastOver.classList.remove('drag-over');
      this.lastOver = col;
    }

    if (col) {
      // Find nearest card to insert before
      const cards = Array.from(col.querySelectorAll(`${this.cardSelector}:not([style*="display: none"])`));
      let insertBefore = null;
      for (const c of cards) {
        if (c === this.dragEl) continue;
        const rect = c.getBoundingClientRect();
        if (point.clientY < rect.top + rect.height / 2) {
          insertBefore = c;
          break;
        }
      }

      if (insertBefore) {
        col.insertBefore(this.placeholder, insertBefore);
      } else {
        // Append to end (before "add card" button if exists)
        const addBtn = col.querySelector('.add-card-inline');
        if (addBtn) {
          col.insertBefore(this.placeholder, addBtn);
        } else {
          col.appendChild(this.placeholder);
        }
      }
    }
  }

  // ─── Pointer Up ─────────────────────────────────────────────────────────────

  _onPointerUp(e, type) {
    if (this._dragTimeout) {
      clearTimeout(this._dragTimeout);
      this._dragTimeout = null;
    }

    if (!this.dragEl || !this.ghost) {
      this.dragEl = null;
      return;
    }

    const targetColumn = this.placeholder?.parentNode?.closest(this.columnSelector)
      || this.placeholder?.parentElement;

    // Restore card
    this.dragEl.style.display = '';

    if (this.placeholder) {
      this.placeholder.parentNode?.insertBefore(this.dragEl, this.placeholder);
      this.placeholder.remove();
      this.placeholder = null;
    }

    this.ghost.remove();
    this.ghost = null;

    if (this.lastOver) {
      this.lastOver.classList.remove('drag-over');
      this.lastOver = null;
    }

    const fromLaneId = this.startColumn?.dataset?.laneId;
    const toLaneId = targetColumn?.closest?.(this.columnSelector)?.dataset?.laneId
      ?? targetColumn?.dataset?.laneId;

    if (this.onDragEnd) this.onDragEnd(this.dragEl);

    if (this.onDrop && toLaneId && fromLaneId !== toLaneId) {
      this.onDrop({
        cardId: this.dragEl.dataset.cardId,
        fromLaneId,
        toLaneId,
      });
    }

    this.dragEl = null;
    this.startColumn = null;
  }

  // ─── Destroy ─────────────────────────────────────────────────────────────────

  destroy() {
    document.removeEventListener('mousedown', this._handleMouseDown);
    document.removeEventListener('mousemove', this._handleMouseMove);
    document.removeEventListener('mouseup', this._handleMouseUp);

    document.removeEventListener('touchstart', this._handleTouchStart);
    document.removeEventListener('touchmove', this._handleTouchMove);
    document.removeEventListener('touchend', this._handleTouchEnd);

    document.removeEventListener('keydown', this._handleKeyDown);
  }
}
