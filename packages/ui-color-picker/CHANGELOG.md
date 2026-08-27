# @clypra/ui-color-picker

## 0.2.0

### Minor Changes

- Add Floating UI popover positioning engine (`@floating-ui/react`):
  - Support `placement` (with `position` backward compatibility alias).
  - Dynamic collision detection via `flip()`, boundary containment via `shift()`, and configurable distance via `offset()`.
  - Automatic position recalculation on scroll/resize via `autoUpdate`.
  - Export `ColorPickerPlacement`, `ColorPickerOffset`, and `ColorPickerStrategy` types.
  - Comprehensive unit test coverage for floating placement calculations.

## 1.1.0

### Minor Changes

- Phase 4R/4S — Editor subsystem, analytics, asset pipeline, visualization system, and color picker

  **@clypra-studio/types**

  - Add AnchorSide, SpatialAnchorConfig, LineNode, VideoNode, AudioNode
  - Extend LayoutMode union (stack, space-between, space-around, space-evenly)
  - Add AxisConfig, ChartBarStyle, ChartAnimationConfig, LinePoint, ArcGeometry
  - Expand MetricNode, ChartNode, GaugeNode, TimelineNode schemas

  **@clypra-studio/engine**

  - Add editor subsystem: EditorCommandSystem, TransformEngine, SelectionEngine,
    SmartGuideEngine, PropertyInspectorEngine, DataBindingAuthoringEngine
  - Add analytics subsystem: MetricEngine, SeriesEngine, GridEngine
  - Add asset pipeline: AssetRegistry, AssetResolver, ResourceCache,
    TemporalMediaEngine, ExportDependencyGraph
  - Add capability registry, behavioral motion system, VideoContext,
    spatial constraint resolver, semantic compiler, runtime evaluator
  - VisualizationEngine generator registry (bar/line/area/pie/donut)
  - Layout engine: space-evenly/stack modes, hug-content text sizing,
    calculateResizeSnap, LayoutComputedState
  - Pixi renderer consumes LayoutComputedState; glassmorphic annotation renderer
  - 22 primitive factories; PublishedOverlayArtifact schema
  - Remove percentage-based coordinate normalization

  **@clypra/ui-color-picker**

  - New package: universal color system with ClypraColorPicker, GradientEditor,
    ColorGradingWheels, ContrastAnalyzer, HarmoniesView, TokenBindingSelector
  - Hooks: useColorDrag, useColorFormat, useColorHistory
  - Utils: colorUtils, colorHarmonies, colorValidation (zero dependencies)

  **@clypra-studio/ui**

  - Re-export full @clypra/ui-color-picker public API
  - Promote usePixiRenderer to shared package

  **@clypra-studio/runtime**

  - Patch bump for internal dependency updates
