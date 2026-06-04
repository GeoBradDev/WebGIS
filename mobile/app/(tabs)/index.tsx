import { useState } from 'react';
import MapViewWrapper from '@/components/MapViewWrapper';
import LayerControls from '@/components/LayerControls';
import FiltersModal from '@/components/FiltersModal';
import FeatureList from '@/components/FeatureList';

export default function MapScreen() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  return (
    <>
      <MapViewWrapper
        controls={<LayerControls onOpenFilters={() => setFiltersOpen(true)} onOpenList={() => setListOpen(true)} />}
      />
      <FiltersModal visible={filtersOpen} onClose={() => setFiltersOpen(false)} />
      <FeatureList visible={listOpen} onClose={() => setListOpen(false)} />
    </>
  );
}
