export const NCTGRAPHITE_VERSION = "0.0.0";

export { NCTParameterPanel, useNCTParameters } from './parameters/NCTGraphiteParameters.js';
export type { NCTParameterDefinition, NCTParameterValues } from './parameters/NCTGraphiteParameters.js';

export {
  NCTGRAPHITE_DOCUMENT_KIND,
  NCTGRAPHITE_DOCUMENT_VERSION,
  NCTGRAPHITE_DOCUMENT_FILE_TYPE,
  NCTGRAPHITE_DOCUMENT_FILE_EXTENSION,
  NCTGraphiteDocument,
  NCTGraphiteDocumentController,
  createNCTGraphiteDocumentId,
  createNCTGraphiteLayerId,
} from './document/NCTGraphiteDocument.js';
export type {
  NCTGraphiteDocumentCanvas,
  NCTGraphiteDocumentView,
  NCTGraphiteDocumentSnapshot,
  NCTGraphiteLayerRecord,
  NCTGraphiteUntitledDocumentOptions,
} from './document/NCTGraphiteDocument.js';
export { useNCTGraphiteDocument } from './document/NCTGraphiteDocumentReact.js';

export { fitDocumentToViewport, documentToViewport, viewportToDocument } from './grid/NCTGraphiteViewport.js';
export type { NCTGraphiteViewportTransform, NCTGraphiteViewportSize, NCTGraphiteViewportPoint } from './grid/NCTGraphiteViewport.js';

export {
  gridCell, gridCellBounds, gridCellCorners, gridCellId, gridCellsInBounds,
  gridCoordinateToPoint, gridNeighbors, pointInGridCell, pointInPolygon,
  pointToFractionalGridCoordinate, pointToGridCoordinate, roundHexCoordinate,
} from './grid/NCTGraphiteGridGeometry.js';
export type {
  NCTGraphiteGridBounds, NCTGraphiteGridCell, NCTGraphiteGridCoordinate,
  NCTGraphiteGridKind, NCTGraphiteGridSpec, NCTGraphitePoint,
} from './grid/NCTGraphiteGridGeometry.js';

export type { NCTGraphiteAppearanceProps, NCTGraphiteComponentMeta, NCTGraphitePropMeta } from './components/NCTGraphiteMeta.js';
export { appearancePropMeta, appearanceStyle } from './components/NCTGraphiteMeta.js';

export { NCTGraphiteSlider, NCTGraphiteSliderMeta } from './components/NCTGraphiteSlider.js';
export type { NCTGraphiteSliderProps } from './components/NCTGraphiteSlider.js';

export { NCTGraphiteField, NCTGraphiteFieldMeta } from './components/NCTGraphiteField.js';
export type { NCTGraphiteFieldProps } from './components/NCTGraphiteField.js';

export { NCTGraphiteTextArea, NCTGraphiteTextAreaMeta } from './components/NCTGraphiteTextArea.js';
export type { NCTGraphiteTextAreaProps } from './components/NCTGraphiteTextArea.js';

export { NCTGraphiteCheckbox, NCTGraphiteCheckboxMeta } from './components/NCTGraphiteCheckbox.js';
export type { NCTGraphiteCheckboxProps } from './components/NCTGraphiteCheckbox.js';

export { NCTGraphiteTabs, NCTGraphiteTabsMeta } from './components/NCTGraphiteTabs.js';
export type { NCTGraphiteTabsProps, NCTGraphiteTabOption } from './components/NCTGraphiteTabs.js';

export { NCTGraphiteList, NCTGraphiteListMeta } from './components/NCTGraphiteList.js';
export type { NCTGraphiteListProps, NCTGraphiteListOption } from './components/NCTGraphiteList.js';

export { NCTGraphiteImageWell, NCTGraphiteImageWellMeta } from './components/NCTGraphiteImageWell.js';
export type { NCTGraphiteImageWellProps } from './components/NCTGraphiteImageWell.js';

export { NCTGraphiteSeparator, NCTGraphiteSeparatorMeta } from './components/NCTGraphiteSeparator.js';
export type { NCTGraphiteSeparatorProps } from './components/NCTGraphiteSeparator.js';

export { NCTGraphiteProgress, NCTGraphiteProgressMeta } from './components/NCTGraphiteProgress.js';
export type { NCTGraphiteProgressProps } from './components/NCTGraphiteProgress.js';

export { NCTGraphiteKnob, NCTGraphiteKnobMeta } from './components/NCTGraphiteKnob.js';
export type { NCTGraphiteKnobProps } from './components/NCTGraphiteKnob.js';

export { NCTGraphiteFader, NCTGraphiteFaderMeta } from './components/NCTGraphiteFader.js';
export type { NCTGraphiteFaderProps } from './components/NCTGraphiteFader.js';

export { NCTGraphiteDualRange, NCTGraphiteDualRangeMeta } from './components/NCTGraphiteDualRange.js';
export type { NCTGraphiteDualRangeProps } from './components/NCTGraphiteDualRange.js';

export { NCTGraphiteMeter, NCTGraphiteMeterMeta } from './components/NCTGraphiteMeter.js';
export type { NCTGraphiteMeterProps } from './components/NCTGraphiteMeter.js';

export { NCTGraphiteValueDisplay, NCTGraphiteValueDisplayMeta } from './components/NCTGraphiteValueDisplay.js';
export type { NCTGraphiteValueDisplayProps } from './components/NCTGraphiteValueDisplay.js';

export { NCTGraphitePanel, NCTGraphitePanelMeta } from './components/NCTGraphitePanel.js';
export type { NCTGraphitePanelProps } from './components/NCTGraphitePanel.js';

export { NCTGraphiteSegmented, NCTGraphiteSegmentedMeta } from './components/NCTGraphiteSegmented.js';
export type { NCTGraphiteSegmentedProps, NCTGraphiteSegmentedOption } from './components/NCTGraphiteSegmented.js';

export { NCTGraphiteSwatch, NCTGraphiteSwatchMeta } from './components/NCTGraphiteSwatch.js';
export type { NCTGraphiteSwatchProps } from './components/NCTGraphiteSwatch.js';

export { NCTGraphiteToggle, NCTGraphiteToggleMeta } from './components/NCTGraphiteToggle.js';
export type { NCTGraphiteToggleProps } from './components/NCTGraphiteToggle.js';

export { NCTGraphiteButton, NCTGraphiteButtonMeta } from './components/NCTGraphiteButton.js';
export type { NCTGraphiteButtonProps } from './components/NCTGraphiteButton.js';

export {
  NCTGraphitePopover, NCTGraphitePopoverMeta, computeNCTGraphitePopoverPosition,
} from './components/NCTGraphitePopover.js';
export type { NCTGraphitePopoverProps, PopoverRect } from './components/NCTGraphitePopover.js';

export { NCTGraphiteHint, NCTGraphiteHintMeta, NCTGraphiteParamLabel } from './components/NCTGraphiteHint.js';
export type { NCTGraphiteHintProps } from './components/NCTGraphiteHint.js';

export { NCTGraphiteStack, NCTGraphiteStackMeta } from './components/NCTGraphiteStack.js';
export type { NCTGraphiteStackProps } from './components/NCTGraphiteStack.js';

export { NCTGraphiteGrid, NCTGraphiteGridMeta } from './components/NCTGraphiteGrid.js';
export type { NCTGraphiteGridProps } from './components/NCTGraphiteGrid.js';

export { NCTGraphiteToolbar, NCTGraphiteToolbarMeta } from './components/NCTGraphiteToolbar.js';
export type { NCTGraphiteToolbarProps } from './components/NCTGraphiteToolbar.js';

export { NCTGraphiteWindow, NCTGraphiteWindowMeta } from './components/NCTGraphiteWindow.js';
export type { NCTGraphiteWindowProps } from './components/NCTGraphiteWindow.js';

export { NCTGraphiteMenuBar, NCTGraphiteMenuBarMeta, NCTGraphiteMenu, NCTGraphiteMenuMeta, NCTGraphiteMenuItem, NCTGraphiteMenuItemMeta } from './components/NCTGraphiteMenuBar.js';
export type { NCTGraphiteMenuBarProps, NCTGraphiteMenuProps, NCTGraphiteMenuItemProps } from './components/NCTGraphiteMenuBar.js';

export {
  useNCTGraphiteCommands, NCTGraphiteCommandsMeta,
} from './bindings/NCTGraphiteCommands.js';
export type {
  NCTGraphiteCommandDef, NCTGraphiteCommandsOptions, NCTGraphiteCommands,
} from './bindings/NCTGraphiteCommands.js';

export {
  NCTGraphiteStage, NCTGraphiteStageMeta,
  NCTGraphiteStageBody, NCTGraphiteStagePanel, NCTGraphiteStageMain,
  NCTGraphiteStageFooter,
} from './components/NCTGraphiteStage.js';
export { NCTGraphiteAppShell, NCTGraphiteAppShellMeta } from './components/NCTGraphiteAppShell.js';
export type { NCTGraphiteAppShellProps } from './components/NCTGraphiteAppShell.js';
export type {
  NCTGraphiteStageProps, NCTGraphiteStageBodyProps,
  NCTGraphiteStagePanelProps, NCTGraphiteStageMainProps,
  NCTGraphiteStageFooterProps,
} from './components/NCTGraphiteStage.js';

export { NCTGraphiteKeyMap, NCTGraphiteKeyMapMeta } from './components/NCTGraphiteKeyMap.js';
export type { NCTGraphiteKeyMapProps } from './components/NCTGraphiteKeyMap.js';

export { NCTGraphiteDialog, NCTGraphiteDialogMeta } from './components/NCTGraphiteDialog.js';
export type { NCTGraphiteDialogProps } from './components/NCTGraphiteDialog.js';

export { NCTGraphiteToast, NCTGraphiteToastMeta } from './components/NCTGraphiteToast.js';
export type { NCTGraphiteToastProps } from './components/NCTGraphiteToast.js';

export {
  convexHull, chaikinSmooth, polygonArea, clusterPolygons, tracePerimeter, hullLoopsFromPolygons,
} from './utilities/graphics/hull.js';
export type { HullMode, HullPolygon, HullLoop } from './utilities/graphics/hull.js';

export {
  metaballKernel, fieldAt, gooToThreshold, buildGridValues, closedRingToBezierD, ringToPathD,
  contourLayersForBlobs, BRUSH_NOISE_PRESETS, brushNoisePreset, perlin2, fbm2, noisyStampCenters,
} from './utilities/graphics/metaballField.js';
export type {
  FieldBlob, PixelPt, ContourLayer, BrushNoisePreset, NoiseStampPt,
} from './utilities/graphics/metaballField.js';

export { satoNeck, roundRectStamp } from './utilities/graphics/satoNeck.js';
export type { StampCenter, RoundRectStamp, SatoNeck } from './utilities/graphics/satoNeck.js';

export {
  makeVectorField, vectorStyle, stampVectorField, applyVectorAttractors, vectorStampDelta,
  VECTOR_BRUSH_OPS, vectorBrushOp, findVectorBrushOp, vectorBrushPickerOps,
  constrainVector, constrainVectorField, snapVectorHeading, quantizeVectorHeading, DEFAULT_VECTOR_LIMITS,
} from './utilities/graphics/vectorField.js';
export type {
  VectorFieldMode, VectorSample, VectorAttractor, VectorStyle, VectorStyleOptions, VectorStampAction,
  VectorBrushOp, VectorBrushContext, VectorFieldLimits,
} from './utilities/graphics/vectorField.js';

export {
  sampleSpacing, makeSampleLattice, shadingFalloff, stampSampleGain,
} from './utilities/graphics/sampleLattice.js';
export type {
  SampleGainPoint, ShadingFalloff, SampleStampAction, SampleRotationMode,
} from './utilities/graphics/sampleLattice.js';

export { NCTGraphiteAccordion, NCTGraphiteAccordionMeta } from './components/NCTGraphiteAccordion.js';
export type { NCTGraphiteAccordionProps } from './components/NCTGraphiteAccordion.js';
export { NCTGraphiteOverlay, NCTGraphiteOverlayMeta } from './components/NCTGraphiteOverlay.js';
export type { NCTGraphiteOverlayProps } from './components/NCTGraphiteOverlay.js';
export { NCTGraphiteScene, NCTGraphiteSceneMeta, NCTGraphiteSceneItem, NCTGraphiteSceneItemMeta } from './components/NCTGraphiteScene.js';
export type { NCTGraphiteSceneProps, NCTGraphiteSceneItemProps } from './components/NCTGraphiteScene.js';
export { NCTGraphiteLayoutItem, NCTGraphiteLayoutItemMeta } from './components/NCTGraphiteLayoutItem.js';
export type { NCTGraphiteLayoutItemProps } from './components/NCTGraphiteLayoutItem.js';
export { NCTGraphiteColumns, NCTGraphiteColumnsMeta } from './components/NCTGraphiteColumns.js';
export type { NCTGraphiteColumnsProps } from './components/NCTGraphiteColumns.js';
export { NCTGraphiteLayoutShell, NCTGraphiteLayoutShellMeta } from './components/NCTGraphiteLayoutShell.js';
export type { NCTGraphiteLayoutShellProps } from './components/NCTGraphiteLayoutShell.js';
export { NCTGraphiteBaseline, NCTGraphiteBaselineMeta } from './components/NCTGraphiteBaseline.js';
export type { NCTGraphiteBaselineProps } from './components/NCTGraphiteBaseline.js';
export { NCTGraphiteSplitter, NCTGraphiteSplitterMeta, shiftPaneSizes } from './components/NCTGraphiteSplitter.js';
export type { NCTGraphiteSplitterProps } from './components/NCTGraphiteSplitter.js';
export { NCTGraphiteColumnGuides, NCTGraphiteColumnGuidesMeta } from './components/NCTGraphiteColumnGuides.js';
export type { NCTGraphiteColumnGuidesProps } from './components/NCTGraphiteColumnGuides.js';
export type { NCTGraphiteGridBreakpoint } from './components/NCTGraphiteGrid.js';

export {
  NCTGRAPHITE_LAYOUT_KIND,
  NCTGRAPHITE_LAYOUT_VERSION,
  NCTGRAPHITE_LAYOUT_FILE_EXTENSION,
  layoutContainers,
  layoutKindLabels,
  makeLayoutNode,
  findLayoutNode,
  updateLayoutNode,
  removeLayoutNode,
  cloneLayoutNode,
  moveLayoutNode,
  duplicateLayoutNode,
  instantiateLayoutModule,
  removeLayoutModuleRefs,
  validLayoutNode,
  validLayoutModule,
  validLayoutDocument,
} from './xml/NCTGraphiteLayoutDocument.js';
export type {
  LayoutDocument,
  LayoutKind,
  LayoutNode,
  LayoutPropValue,
  SavedLayoutModule,
} from './xml/NCTGraphiteLayoutDocument.js';
export {
  LAYOUT_XML_ROOT,
  layoutTagFor,
  serializeLayoutDocument,
  parseLayoutDocument,
} from './xml/NCTGraphiteLayoutXml.js';
export {
  APP_LOGIC_FORMAT,
  APP_LOGIC_VERSION,
  defaultAppLogic,
  validateAppLogic,
  migrateAppLogic,
  parseAppLogicFile,
  serializeAppLogic,
  getBindingIssues,
  resolvePreviewValues,
  resolveNodeProp,
} from './logic/NCTGraphiteAppLogic.js';
export type {
  AppStateType,
  AppStateDef,
  AppCommandDef,
  AppBinding,
  AppLogic,
  BindingIssue,
  PreviewValues,
} from './logic/NCTGraphiteAppLogic.js';
export { buildLayoutCatalog, editablePropsFor } from './xml/NCTGraphiteLayoutCatalog.js';
export type { LayoutCatalogEntry } from './xml/NCTGraphiteLayoutCatalog.js';
export { NCTGraphiteLayoutView, parseNCTOptionList } from './xml/NCTGraphiteLayoutReact.js';

export {
  PanelNode,
  PanelAgent,
  SwarmBoid,
  PanelizationSimulation,
  mulberry32,
} from './panelization/NCTGraphitePanelization.js';
export type {
  PanelColor,
  PanelGeometry,
  PanelAttractor,
  PanelizationConfig,
  PanelizationMesh,
} from './panelization/NCTGraphitePanelization.js';
export {
  NCTGraphiteNurbsSurface,
  createFlatSheetSurface,
  createDemoSheetSurface,
} from './panelization/NCTGraphiteNurbsSurface.js';
export type {
  NCTGraphiteNurbsSurfaceSpec,
  NCTGraphiteSurfaceFrame,
} from './panelization/NCTGraphiteNurbsSurface.js';
export {
  vec3,
  vAdd,
  vSub,
  vScale,
  vMid,
  vDot,
  vCross,
  vLen,
  vDist,
  vUnit,
  vWithLen,
} from './panelization/NCTGraphiteVec3.js';
export type { NCTGraphiteVec3 } from './panelization/NCTGraphiteVec3.js';

export {
  makeDataTree,
  groupToTree,
  treeItems,
  treeBranch,
  flattenTree,
  graftTree,
  simplifyTree,
  mapTree,
  treeStats,
  formatDataPath,
  compareDataPaths,
} from './datatree/NCTGraphiteDataTree.js';
export type {
  DataPath,
  DataBranch,
  DataTree,
  DataTreeStats,
} from './datatree/NCTGraphiteDataTree.js';

export {
  constructTangleLayout,
  TANGLE_PALETTE,
} from './tangle/NCTGraphiteTangleLayout.js';
export type {
  TangleInputNode,
  TangleBundle,
  TangleBundleGroup,
  TangleNode,
  TangleLink,
  TangleLayoutResult,
  TangleLayoutOptions,
} from './tangle/NCTGraphiteTangleLayout.js';

export {
  buildSunburst,
  descendants as sunburstDescendants,
  ancestors as sunburstAncestors,
  zoomTargets,
  arcVisible,
  labelVisible,
  interpolateSlice,
  colourAncestor,
  interpolateRainbow,
  rainbowPalette,
  sunburstColourScale,
} from './sunburst/NCTGraphiteSunburstLayout.js';
export type {
  SunburstData,
  SunburstSlice,
  SunburstNode,
} from './sunburst/NCTGraphiteSunburstLayout.js';

export {
  horizonWalk,
  mulberry32,
  horizonBandColor,
  SCHEME_GREENS,
  SCHEME_BLUES,
  horizonBandFill,
  horizonY,
  ACTIVITY_LANES,
  HorizonSeries,
  createMonitor,
  horizonReliefGeometry,
} from './horizon/NCTGraphiteHorizon.js';
export type {
  HorizonStrip,
  ActivityLane,
  HorizonReliefOptions,
  HorizonRelief,
} from './horizon/NCTGraphiteHorizon.js';

export {
  buildTreemap,
  descendants as treemapDescendants,
  ancestors as treemapAncestors,
  treemapPath,
  zoomTargets as treemapZoomTargets,
  resetCurrents,
  binaryTileRects,
  TREEMAP_WIDTH,
  TREEMAP_HEIGHT,
  SCHEME_CATEGORY10,
  treemapHouse,
  treemapHouseColor,
  treemapCubeFaces,
  TREEMAP_CUBE_FACES,
} from './treemap/NCTGraphiteTreemapLayout.js';
export type {
  TreemapData,
  TreemapRect,
  TreemapNode,
  TreemapCubeFace,
  TreemapCubePiece,
} from './treemap/NCTGraphiteTreemapLayout.js';
