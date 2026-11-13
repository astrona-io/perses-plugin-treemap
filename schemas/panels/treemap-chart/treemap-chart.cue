package model

import (
	"github.com/perses/shared/cue/common"
)

// A Prometheus label name.
#labelName: string & =~"^[a-zA-Z_][a-zA-Z0-9_]*$"

kind: "TreemapChart"
spec: close({
	// How each series is reduced to one value (last, sum, mean, ...).
	calculation: common.#calculation
	// Ordered label names, one level of the hierarchy each, outermost first (1 to 4). Same shape
	// as the Sankey plugin's levels. A missing label groups the series under "(none)".
	// Default ["namespace", "pod"].
	levels?: [#labelName] | [#labelName, #labelName] | [#labelName, #labelName, #labelName] | [#labelName, #labelName, #labelName, #labelName]
	format?: common.#format
	// topLevel: one palette color per outermost box, shared by everything inside it.
	// thresholds: each box by its value (percent mode: its share of the total). Default topLevel.
	colorBy?: "topLevel" | "thresholds"
	// Used when colorBy is thresholds.
	thresholds?: common.#thresholds
	// Keep the largest N boxes under each parent, at every level; the rest are summed into
	// "Other". Unset: no limit.
	topN?: int & >=1
	// Show the path to the open box, with a way back up. Default true.
	showBreadcrumb?: bool
})
