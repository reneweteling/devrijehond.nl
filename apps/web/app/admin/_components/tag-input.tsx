'use client';

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react';

export type TagOption = { id: string; label: string };

export interface TagInputProps {
  value: TagOption[];
  onChange: (next: TagOption[]) => void;
  suggestions: TagOption[];
  onCreate?: (label: string) => Promise<TagOption | null>;
  placeholder?: string;
  allowCreate?: boolean;
}

export function TagInput({
  value,
  onChange,
  suggestions,
  onCreate,
  placeholder = 'Toevoegen…',
  allowCreate = false,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the filtered suggestion list: exclude already-selected ids.
  const selectedIds = new Set(value.map((t) => t.id));
  const trimmed = inputValue.trim();

  const filtered = suggestions.filter(
    (s) => !selectedIds.has(s.id) && s.label.toLowerCase().includes(trimmed.toLowerCase()),
  );

  // "Create new" option: only when allowCreate, onCreate exists, trimmed is
  // non-empty, and there is no exact-match suggestion.
  const hasExactMatch = suggestions.some(
    (s) => s.label.toLowerCase() === trimmed.toLowerCase() && !selectedIds.has(s.id),
  );
  const showCreate = allowCreate && onCreate && trimmed.length > 0 && !hasExactMatch;

  const totalOptions = filtered.length + (showCreate ? 1 : 0);

  // Close dropdown when clicking outside.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  function addTag(tag: TagOption) {
    if (selectedIds.has(tag.id)) return;
    onChange([...value, tag]);
    setInputValue('');
    setDropdownOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }

  function removeTag(id: string) {
    onChange(value.filter((t) => t.id !== id));
  }

  function removeLastTag() {
    if (value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  async function handleCreate() {
    if (!onCreate || !trimmed) return;
    setCreating(true);
    try {
      const created = await onCreate(trimmed);
      if (created) addTag(created);
      else {
        setInputValue('');
        setDropdownOpen(false);
      }
    } finally {
      setCreating(false);
    }
  }

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setDropdownOpen(true);
    setActiveIndex(-1);
  }, []);

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalOptions - 1));
      setDropdownOpen(true);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        const active = filtered[activeIndex];
        if (active) addTag(active);
      } else if (activeIndex === filtered.length && showCreate) {
        void handleCreate();
      } else if (filtered.length === 1) {
        const first = filtered[0];
        if (first) addTag(first);
      } else if (hasExactMatch) {
        const match = suggestions.find(
          (s) => s.label.toLowerCase() === trimmed.toLowerCase() && !selectedIds.has(s.id),
        );
        if (match) addTag(match);
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
      setActiveIndex(-1);
    } else if (e.key === 'Backspace' && inputValue === '') {
      removeLastTag();
    }
  }

  return (
    <div
      className="admin-tag-input"
      ref={containerRef}
      role="combobox"
      aria-expanded={dropdownOpen}
      aria-haspopup="listbox"
    >
      {value.map((tag) => (
        <span key={tag.id} className="admin-tag-chip">
          {tag.label}
          <button
            type="button"
            className="admin-tag-chip__remove"
            onClick={() => removeTag(tag.id)}
            aria-label={`Verwijder ${tag.label}`}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <line x1="1" y1="1" x2="11" y2="11" />
              <line x1="11" y1="1" x2="1" y2="11" />
            </svg>
          </button>
        </span>
      ))}

      <input
        ref={inputRef}
        className="admin-tag-input__field"
        type="text"
        value={inputValue}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (trimmed || filtered.length > 0) setDropdownOpen(true);
        }}
        placeholder={value.length === 0 ? placeholder : undefined}
        disabled={creating}
        aria-autocomplete="list"
        aria-controls="tag-input-listbox"
        aria-activedescendant={activeIndex >= 0 ? `tag-opt-${activeIndex}` : undefined}
      />

      {dropdownOpen && totalOptions > 0 ? (
        <ul className="admin-tag-dropdown" id="tag-input-listbox" role="listbox">
          {filtered.map((opt, i) => (
            <li
              key={opt.id}
              id={`tag-opt-${i}`}
              role="option"
              aria-selected={activeIndex === i}
              className={`admin-tag-dropdown__item${activeIndex === i ? ' is-active' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault();
                addTag(opt);
              }}
            >
              {opt.label}
            </li>
          ))}
          {showCreate ? (
            <li
              id={`tag-opt-${filtered.length}`}
              role="option"
              aria-selected={activeIndex === filtered.length}
              className={`admin-tag-dropdown__item admin-tag-dropdown__item--create${activeIndex === filtered.length ? ' is-active' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault();
                void handleCreate();
              }}
            >
              {creating ? 'Toevoegen…' : `Nieuw: '${trimmed}' toevoegen`}
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
