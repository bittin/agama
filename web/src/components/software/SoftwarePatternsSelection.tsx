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
  Label,
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
import { Page } from "~/components/core";
import { _ } from "~/i18n";
import a11yStyles from "@patternfly/react-styles/css/utilities/Accessibility/accessibility";
import { useSystem } from "~/hooks/model/system/software";
import { SelectedBy } from "~/model/proposal/software";
import { useProposal } from "~/hooks/model/proposal/software";
import { patchConfig } from "~/api";
import { SOFTWARE } from "~/routes/paths";
import { useAppForm } from "~/hooks/form";
import { filterPatterns, groupPatterns, isPatternSelected, sortGroupNames } from "~/utils/software";

/**
 * Form options for pattern selection.
 */
const softwarePatternsFormOptions = formOptions({
  defaultValues: {
    selectedPatterns: [] as string[],
  },
});

const NoMatches = (): React.ReactNode => <b>{_("None of the patterns match the filter.")}</b>;

/**
 * Pattern selector component
 */
function SoftwarePatternsSelection(): React.ReactNode {
  const navigate = useNavigate();
  const { patterns } = useSystem();
  const proposal = useProposal();
  const selection = proposal?.patterns || {};
  const [searchValue, setSearchValue] = useState("");

  // Extract initially selected patterns (USER or AUTO)
  const initialSelection = patterns
    .filter((p) => isPatternSelected(selection, p.name))
    .map((p) => p.name);

  const form = useAppForm({
    ...softwarePatternsFormOptions,
    defaultValues: {
      selectedPatterns: initialSelection,
    },
    onSubmit: async ({ value: formValues }) => {
      const selectedSet = new Set(formValues.selectedPatterns);

      // All selected patterns become USER-selected
      const add = formValues.selectedPatterns;

      // Patterns that were previously selected (AUTO or USER) or preselected but now unchecked
      const remove = patterns
        .filter((p) => {
          const wasSelected = isPatternSelected(selection, p.name);
          const isNowUnselected = !selectedSet.has(p.name);

          return isNowUnselected && (wasSelected || p.preselected);
        })
        .map((p) => p.name);

      await patchConfig({ software: { patterns: { add, remove } } });
      navigate(SOFTWARE.root);
    },
  });

  // initial empty screen, the patterns are loaded very quickly, no need for any progress
  const visiblePatterns = filterPatterns(patterns, searchValue);
  if (visiblePatterns.length === 0 && searchValue === "") return null;

  const groups = groupPatterns(visiblePatterns);

  return (
    <Page
      breadcrumbs={[{ label: _("Software"), path: SOFTWARE.root }, { label: "Patterns selection" }]}
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
              <form.Subscribe selector={(s) => s.values.selectedPatterns}>
                {(selectedPatterns) => {
                  const selectedSet = new Set(selectedPatterns);
                  const selector = sortGroupNames(groups).map((groupName) => (
                    <section key={groupName}>
                      <Content component="h3">{groupName}</Content>
                      <DataList isCompact aria-label={groupName}>
                        {groups[groupName].map((option) => {
                          const titleId = `${option.name}-title`;
                          const descId = `${option.name}-desc`;
                          const selected = selectedSet.has(option.name);
                          const nextActionId = `${option.name}-next-action`;

                          return (
                            <DataListItem key={option.name}>
                              <DataListItemRow>
                                <DataListCheck
                                  onChange={(_, value) => {
                                    const updated = value
                                      ? [...selectedPatterns, option.name]
                                      : selectedPatterns.filter((name) => name !== option.name);
                                    form.setFieldValue("selectedPatterns", updated);
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
                                            <Label color="blue" isCompact>
                                              {_("auto selected")}
                                            </Label>
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
                            </DataListItem>
                          );
                        })}
                      </DataList>
                    </section>
                  ));

                  return selector.length > 0 ? <Stack hasGutter>{selector}</Stack> : <NoMatches />;
                }}
              </form.Subscribe>
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
