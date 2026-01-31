import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import COUNTERS_CONFIG from '@/data/counters.json';

const MAX_COUNTERS = 5;

export default function DragAndDropCounterSelector({ selectedCounters, onCountersChange, maxCounters = MAX_COUNTERS }) {
  const availableCounters = COUNTERS_CONFIG.filter(
    (counter) => !selectedCounters.find((selected) => selected.id === counter.id)
  );

  // Configure sensors for mouse, touch, and keyboard
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts (prevents accidental drags)
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 250ms touch hold before drag starts
        tolerance: 0, // No movement tolerance - must hold still
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = selectedCounters.findIndex((c) => c.id === active.id);
      const newIndex = selectedCounters.findIndex((c) => c.id === over.id);

      onCountersChange(arrayMove(selectedCounters, oldIndex, newIndex));
    }
  };

  const handleRemoveCounter = (counterId) => {
    const newCounters = selectedCounters.filter((c) => c.id !== counterId);
    onCountersChange(newCounters);
  };

  const handleAddCounter = (counter) => {
    if (selectedCounters.length >= maxCounters) return;
    onCountersChange([...selectedCounters, counter]);
  };

  return (
    <div className='counter-selector-container'>
      <div className='selected-counters-zone'>
        <div className='zone-header'>
          <h3>Selected Counters</h3>
          <span className='counter-limit-badge'>
            {selectedCounters.length}/{maxCounters}
          </span>
        </div>
        {selectedCounters.length === 0 ? (
          <div className='empty-state'>No counters selected. Click a counter below to add it.</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={selectedCounters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
              <div className='counter-list'>
                {selectedCounters.map((counter) => (
                  <SortableCounterItem key={counter.id} counter={counter} onRemove={handleRemoveCounter} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className='available-counters-zone'>
        <h3>Available Counters</h3>
        {availableCounters.length === 0 ? (
          <div className='empty-state'>All counters are selected.</div>
        ) : (
          <div className='counter-list'>
            {availableCounters.map((counter) => (
              <button
                key={counter.id}
                type='button'
                className={`counter-item available ${selectedCounters.length >= maxCounters ? 'disabled' : ''}`}
                onClick={() => handleAddCounter(counter)}
                disabled={selectedCounters.length >= maxCounters}
                title={
                  selectedCounters.length >= maxCounters
                    ? `Maximum ${maxCounters} counters allowed`
                    : `Click to add ${counter.label}`
                }
              >
                <div className='counter-color-indicator' style={{ backgroundColor: counter.color }}></div>
                <span className='counter-label'>{counter.label}</span>
                <span className='add-icon'>+</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SortableCounterItem({ counter, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: counter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`counter-item selected ${isDragging ? 'dragging' : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className='drag-handle' title='Drag to reorder'>
        <svg width='16' height='16' viewBox='0 0 16 16' fill='currentColor'>
          <circle cx='6' cy='4' r='1.5' />
          <circle cx='10' cy='4' r='1.5' />
          <circle cx='6' cy='8' r='1.5' />
          <circle cx='10' cy='8' r='1.5' />
          <circle cx='6' cy='12' r='1.5' />
          <circle cx='10' cy='12' r='1.5' />
        </svg>
      </div>
      <div className='counter-color-indicator' style={{ backgroundColor: counter.color }}></div>
      <span className='counter-label'>{counter.label}</span>
      <button
        type='button'
        className='remove-button'
        onClick={() => onRemove(counter.id)}
        title={`Remove ${counter.label}`}
        aria-label={`Remove ${counter.label}`}
      >
        ×
      </button>
    </div>
  );
}
