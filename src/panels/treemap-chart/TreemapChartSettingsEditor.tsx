import { ReactElement } from "react";
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Stack,
  SvgIcon,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import {
  FormatControls,
  FormatOptions,
  OptionsEditorColumn,
  OptionsEditorControl,
  OptionsEditorGrid,
  OptionsEditorGroup,
  ThresholdsEditor,
} from "@perses-dev/components";
import { CalculationSelector } from "@perses-dev/plugin-system";
import {
  ColorBy,
  DEFAULT_COLOR_BY,
  DEFAULT_LEVELS,
  DEFAULT_SHOW_BREADCRUMB,
  LABEL_NAME_PATTERN,
  MAX_LEVELS,
  MIN_LEVELS,
  TreemapChartEditorProps,
  TreemapChartOptions,
} from "./treemap-chart-types";

const DEFAULT_FORMAT: FormatOptions = { unit: "decimal" };

const ICONS = {
  up: "M7 14l5-5 5 5z",
  down: "M7 10l5 5 5-5z",
  remove:
    "M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z",
};

/** A whole number of at least 1, or undefined for an empty or invalid field. */
export function parseCount(raw: string): number | undefined {
  if (raw.trim() === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : undefined;
}

interface LevelsEditorProps {
  levels: string[];
  onChange: (levels: string[]) => void;
}

/** Ordered list of label names, one level of the hierarchy each. Same editor as the Sankey plugin's, 1 to 4 levels. */
function LevelsEditor(props: LevelsEditorProps): ReactElement {
  const { levels, onChange } = props;
  const move = (from: number, to: number): void => {
    const next = [...levels];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item as string);
    onChange(next);
  };
  const iconButton = (
    label: string,
    path: string,
    onClick: () => void,
    disabled: boolean,
  ): ReactElement => (
    <IconButton
      size="small"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      <SvgIcon sx={{ fontSize: 18 }}>
        <path d={path} />
      </SvgIcon>
    </IconButton>
  );

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary">
        One level per label, outermost first. Series that share every label are
        summed; a missing label goes into &quot;(none)&quot;.
      </Typography>
      {levels.map((level, i) => {
        const invalid = level !== "" && !LABEL_NAME_PATTERN.test(level);
        return (
          <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <TextField
              size="small"
              fullWidth
              label={`Level ${i + 1}`}
              value={level}
              error={invalid || level === ""}
              helperText={
                invalid
                  ? "Letters, digits and _ only"
                  : level === ""
                    ? "Label name required"
                    : undefined
              }
              onChange={(e) => {
                const next = [...levels];
                next[i] = e.target.value.trim();
                onChange(next);
              }}
            />
            {iconButton("Move up", ICONS.up, () => move(i, i - 1), i === 0)}
            {iconButton(
              "Move down",
              ICONS.down,
              () => move(i, i + 1),
              i === levels.length - 1,
            )}
            {iconButton(
              "Remove level",
              ICONS.remove,
              () => onChange(levels.filter((_, j) => j !== i)),
              levels.length <= MIN_LEVELS,
            )}
          </Box>
        );
      })}
      <Box>
        <Button
          size="small"
          disabled={levels.length >= MAX_LEVELS}
          onClick={() => onChange([...levels, ""])}
        >
          Add level
        </Button>
      </Box>
    </Stack>
  );
}

export function TreemapChartSettingsEditor(
  props: TreemapChartEditorProps,
): ReactElement {
  const { onChange, value } = props;
  const set = (patch: Partial<TreemapChartOptions>): void =>
    onChange({ ...value, ...patch });
  const colorBy = value.colorBy ?? DEFAULT_COLOR_BY;

  return (
    <OptionsEditorGrid>
      <OptionsEditorColumn>
        <OptionsEditorGroup title="Data">
          {/* Renders its own labelled control. Series that share a box are summed after it. */}
          <CalculationSelector
            value={value.calculation ?? "last"}
            onChange={(calculation) => set({ calculation })}
          />
          <OptionsEditorControl
            label="Top N"
            description="Keep the largest N boxes under each parent; the rest are summed into Other. Empty for all"
            control={
              <TextField
                size="small"
                type="number"
                inputProps={{ min: 1, step: 1 }}
                value={value.topN ?? ""}
                onChange={(e) => set({ topN: parseCount(e.target.value) })}
              />
            }
          />
        </OptionsEditorGroup>
        <OptionsEditorGroup title="Levels">
          <LevelsEditor
            levels={value.levels ?? DEFAULT_LEVELS}
            onChange={(levels) => set({ levels })}
          />
        </OptionsEditorGroup>
        <OptionsEditorGroup title="Format">
          <FormatControls
            value={value.format ?? DEFAULT_FORMAT}
            onChange={(format) => set({ format })}
          />
        </OptionsEditorGroup>
      </OptionsEditorColumn>
      <OptionsEditorColumn>
        <OptionsEditorGroup title="Display">
          <OptionsEditorControl
            label="Color by"
            description="Top level: one color per outermost box, shared by everything inside it. Thresholds: each box by its value"
            control={
              <TextField
                select
                size="small"
                value={colorBy}
                onChange={(e) => set({ colorBy: e.target.value as ColorBy })}
              >
                <MenuItem value="topLevel">Top level</MenuItem>
                <MenuItem value="thresholds">Thresholds</MenuItem>
              </TextField>
            }
          />
          <OptionsEditorControl
            label="Show breadcrumb"
            description="The path to the open box, with a way back up. When off, an Up button appears after drilling in"
            control={
              <Switch
                checked={value.showBreadcrumb ?? DEFAULT_SHOW_BREADCRUMB}
                onChange={(_, showBreadcrumb) => set({ showBreadcrumb })}
              />
            }
          />
        </OptionsEditorGroup>
        {colorBy === "thresholds" ? (
          <ThresholdsEditor
            thresholds={value.thresholds}
            onChange={(thresholds) => set({ thresholds })}
          />
        ) : null}
      </OptionsEditorColumn>
    </OptionsEditorGrid>
  );
}
