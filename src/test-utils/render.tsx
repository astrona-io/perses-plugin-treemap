import type { ReactElement, ReactNode } from "react";
import { render, type RenderResult } from "@testing-library/react";
import { createTheme, ThemeProvider } from "@mui/material";
import { ChartsProvider, generateChartsTheme } from "@perses-dev/components";

const muiTheme = createTheme();
const chartsTheme = generateChartsTheme(muiTheme, {});

function Providers({ children }: { children?: ReactNode }): ReactElement {
  return (
    <ThemeProvider theme={muiTheme}>
      <ChartsProvider chartsTheme={chartsTheme}>{children}</ChartsProvider>
    </ThemeProvider>
  );
}

/** `render` inside the MUI and Perses charts themes, as Perses renders a panel. */
export function renderWithTheme(ui: ReactElement): RenderResult {
  return render(ui, { wrapper: Providers });
}
