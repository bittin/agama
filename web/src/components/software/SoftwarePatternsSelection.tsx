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
 * Each pattern is a boolean field (pattern name -> selected state).
 */
const softwarePatternsFormOptions = formOptions({
  defaultValues: {} as Record<string, boolean>,
});

const NoMatches = (): React.ReactNode => <b>{_("None of the patterns match the filter.")}</b>;

/**
 * Pattern selector component
 */
function SoftwarePatternsSelection() {
  const navigate = useNavigate();
  const { patterns } = useSystem();
  const proposal = useProposal();
  const selection = proposal?.patterns || {};
  const [searchValue, setSearchValue] = useState("");

  // Build initial form values: each pattern name -> selected boolean
  const initialValues = patterns.reduce(
    (acc, pattern) => {
      acc[pattern.name] = isPatternSelected(selection, pattern.name);
      return acc;
    },
    {} as Record<string, boolean>,
  );

  const form = useAppForm({
    ...softwarePatternsFormOptions,
    defaultValues: initialValues,
    onSubmit: async ({ value: formValues, formApi }) => {
      // Skip API call if form is pristine (nothing changed)
      if (!formApi.state.isDirty) {
        navigate(SOFTWARE.root);
        return;
      }

      // Add: selected patterns that user touched OR were already USER-selected
      const add = patterns
        .filter((p) => {
          const isSelected = formValues[p.name];
          if (!isSelected) return false;

          const isDirty = formApi.getFieldMeta(p.name)?.isDirty;
          const wasUserSelected = selection[p.name] === SelectedBy.USER;

          // Add if user touched it OR it was already USER-selected
          return isDirty || wasUserSelected;
        })
        .map((p) => p.name);

      // Remove: unchecked patterns that were previously selected, preselected, or explicitly removed
      const remove = patterns
        .filter((p) => {
          const isSelected = formValues[p.name];
          if (isSelected) return false;

          const wasInitiallySelected = initialValues[p.name];
          const wasExplicitlyRemoved = selection[p.name] === SelectedBy.REMOVED;

          return wasInitiallySelected || p.preselected || wasExplicitlyRemoved;
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
