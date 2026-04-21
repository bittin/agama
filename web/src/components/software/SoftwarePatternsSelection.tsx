/*
 * Copyright (c) [2023-2026] SUSE LLC
 *
 * All Rights Reserved.
 *
 * This program is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program; if not, contact SUSE LLC.
 *
 * To contact SUSE LLC about this file by physical or electronic mail, you may
 * find current contact information at www.suse.com.
 */

import React, { useState } from "react";
import {
  DataList,
  DataListCell,
  DataListCheck,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  SearchInput,
  Stack,
  Content,
  ActionGroup,
  Form,
} from "@patternfly/react-core";
import { formOptions } from "@tanstack/react-form";
import { useNavigate } from "react-router";
import Page from "~/components/core/Page";
import AutoSelectedLabel from "~/components/software/AutoSelectedLabel";
import { SelectedBy } from "~/model/proposal/software";
import { patchConfig } from "~/api";
import { useSystem } from "~/hooks/model/system/software";
import { useProposal } from "~/hooks/model/proposal/software";
import { usePristineSafeForm } from "~/hooks/form";
import { filterPatterns, groupPatterns, isPatternSelected, sortGroupNames } from "~/utils/software";
import { SOFTWARE } from "~/routes/paths";
import { N_, _ } from "~/i18n";

import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import type { Pattern } from "~/model/system/software";

/**
 * Form options for pattern selection.
 * Each pattern is a boolean field (pattern name -> selected state).
 */
const softwarePatternsFormOptions = formOptions({
  defaultValues: {},
});

const NoMatches = (): React.ReactNode => <b>{_("None of the patterns match the filter.")}</b>;

/**
 * Controls which patterns the selection page shows.
 * - "all": all available patterns
 * - "desktops": only patterns representing desktop environments
 * - "other": non-desktop patterns
 */
type Scope = "all" | "desktops" | "other";

/**
 * Resolves what action, if any, a pattern should produce on submit.
 *
 * Visible patterns (inScope):
 * - "add" when checked AND there is clear user intent: the user just toggled it,
 *   or it was already their explicit choice. Avoids re-adding auto-selected patterns
 *   the user never touched.
 * - "remove" when unchecked AND previously relevant: selected on load, a product
 *   default, or already explicitly removed. Patterns never seen before are ignored.
 * - null otherwise.
 *
 * Hidden patterns (not inScope) pass through their existing user selection unchanged,
 * preserving choices made on a different scope. The proposal's selection status is
 * the source of truth: USER means the user explicitly added it, REMOVED means the
 * user explicitly removed it.
 *
 * @param inScope - Whether the pattern is visible in the current scope
 * @param isChecked - Current checkbox value in the form
 * @param isDirty - Whether the user changed the checkbox from its initial value
 * @param isPreselected - Whether the pattern is selected by default in the product
 * @param wasInitiallySelected - Whether the pattern was selected when the form loaded
 * @param selectionStatus - Current backend selection status for this pattern
 */
const resolvePatternAction = (
  inScope: boolean,
  isChecked: boolean,
  isDirty: boolean,
  isPreselected: boolean,
  wasInitiallySelected: boolean,
  selectionStatus: SelectedBy | undefined,
): "add" | "remove" | undefined => {
  if (!inScope) {
    if (selectionStatus === SelectedBy.USER) return "add";
    if (selectionStatus === SelectedBy.REMOVED) return "remove";
    return;
  }
  if (isChecked && (isDirty || selectionStatus === SelectedBy.USER)) return "add";
  if (
    !isChecked &&
    (wasInitiallySelected || isPreselected || selectionStatus === SelectedBy.REMOVED)
  )
    return "remove";
};

/** Values use `N_()` for extraction. Translate with `_()` at render time. */
const PAGE_TITLE: Record<Scope, string> = {
  // TRANSLATORS: page title when selecting all software patterns
  all: N_("Patterns selection"),
  // TRANSLATORS: page title when selecting desktop environments
  desktops: N_("Desktop selection"),
  // TRANSLATORS: page title when selecting non-desktop software patterns
  other: N_("Patterns selection"),
};

/**
 * Pattern selector component.
 *
 * @param scope - Which patterns to show: "all", "desktops", or "other" (non-desktop patterns).
 *   Defaults to "all".
 */
function SoftwarePatternsSelection({ scope = "all" }: { scope?: Scope }) {
  const navigate = useNavigate();
  const { patterns: systemPatterns } = useSystem();
  const proposal = useProposal();
  const selection = proposal?.patterns || {};
  const [searchValue, setSearchValue] = useState("");

  let scopedPatterns: Pattern[];
  switch (scope) {
    case "desktops":
      scopedPatterns = systemPatterns.filter((p) => p.desktop);
      break;
    case "other":
      scopedPatterns = systemPatterns.filter((p) => !p.desktop);
      break;
    default:
      scopedPatterns = systemPatterns;
  }

  // Build initial form values: each pattern name -> selected boolean
  const initialValues = scopedPatterns.reduce((acc, pattern) => {
    acc[pattern.name] = isPatternSelected(selection, pattern.name);
    return acc;
  }, {});

  const form = usePristineSafeForm({
    ...softwarePatternsFormOptions,
    defaultValues: initialValues,
    onSubmit: async ({ value: formValues, formApi }) => {
      const { add, remove } = systemPatterns.reduce(
        (acc, p) => {
          const inScope = p.name in initialValues;
          const isChecked = formValues[p.name];
          const isDirty = formApi.getFieldMeta(p.name)?.isDirty ?? false;
          const wasInitiallySelected = initialValues[p.name];
          const selectionStatus = selection[p.name];

          const action = resolvePatternAction(
            inScope,
            isChecked,
            isDirty,
            p.preselected,
            wasInitiallySelected,
            selectionStatus,
          );

          if (action) acc[action].push(p.name);
          return acc;
        },
        { add: [], remove: [] },
      );

      await patchConfig({ software: { patterns: { add, remove } } });
    },
    onSubmitComplete: () => navigate(SOFTWARE.root),
  });

  // initial empty screen, the patterns are loaded very quickly, no need for any progress
  const visiblePatterns = filterPatterns(scopedPatterns, searchValue);
  if (visiblePatterns.length === 0 && searchValue === "") return null;

  const groups = groupPatterns(visiblePatterns);

  return (
    <Page
      breadcrumbs={[
        { label: _("Software"), path: SOFTWARE.root },
        {
          // TRANSLATORS: breadcrumb label for the pattern/desktop selection page
          // eslint-disable-next-line agama-i18n/string-literals
          label: _(PAGE_TITLE[scope]),
        },
      ]}
      progress={{ scope: "software" }}
    >
      <Page.Content>
        <form.AppForm>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              form.handleSubmit();
            }}
          >
            <SearchInput
              // TRANSLATORS: search field placeholder text
              placeholder={_("Filter by pattern title or description")}
              aria-label={_("Filter by pattern title or description")}
              value={searchValue}
              onChange={(_event, value) => setSearchValue(value)}
              onClear={() => setSearchValue("")}
              resultsCount={visiblePatterns.length}
            />
            <Page.Section title="Patterns">
              <Stack hasGutter>
                {sortGroupNames(groups).map((groupName) => (
                  <section key={groupName}>
                    <Content component="h3">{groupName}</Content>
                    <DataList isCompact aria-label={groupName}>
                      {groups[groupName].map((option) => {
                        const titleId = `${option.name}-title`;
                        const descId = `${option.name}-desc`;
                        const nextActionId = `${option.name}-next-action`;

                        return (
                          <DataListItem key={option.name}>
                            <form.Subscribe selector={(s) => s.values[option.name]}>
                              {(selected) => (
                                <DataListItemRow>
                                  <DataListCheck
                                    onChange={(_, value) => {
                                      form.setFieldValue(option.name, value);
                                    }}
                                    aria-labelledby={[nextActionId, titleId].join(" ")}
                                    isChecked={selected}
                                  />
                                  <DataListItemCells
                                    dataListCells={[
                                      <DataListCell key="summary">
                                        <Stack hasGutter>
                                          <div>
                                            <b id={titleId}>{option.summary}</b>{" "}
                                            {selection[option.name] === SelectedBy.AUTO && (
                                              <AutoSelectedLabel />
                                            )}
                                            <span id={nextActionId} className={a11yStyles.hidden}>
                                              {selected ? _("Unselect") : _("Select")}
                                            </span>
                                          </div>
                                          <div id={descId}>{option.description}</div>
                                        </Stack>
                                      </DataListCell>,
                                    ]}
                                  />
                                </DataListItemRow>
                              )}
                            </form.Subscribe>
                          </DataListItem>
                        );
                      })}
                    </DataList>
                  </section>
                ))}
              </Stack>
              {visiblePatterns.length === 0 && <NoMatches />}
            </Page.Section>

            <ActionGroup>
              <form.SubmitButton />
              <form.CancelButton />
            </ActionGroup>
          </Form>
        </form.AppForm>
      </Page.Content>
    </Page>
  );
}

export default SoftwarePatternsSelection;
