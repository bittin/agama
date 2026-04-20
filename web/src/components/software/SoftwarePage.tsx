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

import React from "react";
import xbytes from "xbytes";
import { fork, isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Content,
  EmptyState,
  EmptyStateActions,
  EmptyStateBody,
  EmptyStateFooter,
  ExpandableSection,
  Grid,
  GridItem,
  List,
  ListItem,
} from "@patternfly/react-core";
import IssuesAlert from "~/components/core/IssuesAlert";
import Link from "~/components/core/Link";
import NestedContent from "~/components/core/NestedContent";
import Page from "~/components/core/Page";
import SubtleContent from "~/components/core/SubtleContent";
import Text from "~/components/core/Text";
import AutoSelectedLabel from "~/components/software/AutoSelectedLabel";
import { useIssues } from "~/hooks/model/issue";
import { useProposal } from "~/hooks/model/proposal/software";
import { useSystem } from "~/hooks/model/system/software";
import { isDesktopPattern, isPatternSelected } from "~/utils/software";
import { SOFTWARE as PATHS } from "~/routes/paths";
import { _, n_ } from "~/i18n";

import type { Pattern } from "~/model/system/software";
import type { PatternsSelection } from "~/model/proposal/software";
import { SelectedBy } from "~/model/proposal/software";

/**
 * Empty state for a software section where nothing has been selected yet.
 */
const NothingSelected = ({ body, buttonText }: { body: string; buttonText: string }) => (
  // TRANSLATORS: empty state title for a software section with nothing selected
  <EmptyState headingLevel="h4" titleText={_("None selected")} variant="sm">
    <EmptyStateBody>{body}</EmptyStateBody>
    <EmptyStateFooter>
      <EmptyStateActions>
        <Link to={PATHS.patternsSelection} isPrimary>
          {buttonText}
        </Link>
      </EmptyStateActions>
    </EmptyStateFooter>
  </EmptyState>
);

/**
 * List of selected patterns.
 */
const SelectedPatternsList = ({
  patterns,
  selection,
  emptyContent,
}: {
  patterns: Pattern[];
  selection: PatternsSelection;
  emptyContent: React.ReactNode;
}) => {
  if (patterns.length === 0) {
    return emptyContent;
  }

  return (
    <NestedContent margin="myMd">
      <NestedContent margin="mxSm">
        <List isPlain>
          {patterns.map((pattern) => (
            <ListItem key={pattern.name}>
              <Text>
                <Text isBold>{pattern.summary} </Text>
                {selection[pattern.name] === SelectedBy.AUTO && <AutoSelectedLabel />}
              </Text>
              <NestedContent margin="mxXs">
                <ExpandableSection
                  variant="truncate"
                  truncateMaxLines={2}
                  // TRANSLATORS: button to expand truncated pattern description
                  toggleTextCollapsed={_("Read more")}
                  // TRANSLATORS: button to collapse expanded pattern description
                  toggleTextExpanded={_("Read less")}
                >
                  <SubtleContent>{pattern.description}</SubtleContent>
                </ExpandableSection>
              </NestedContent>
            </ListItem>
          ))}
        </List>
      </NestedContent>
    </NestedContent>
  );
};

/**
 * Displays the estimated disk space required by the current software selection.
 *
 * Renders nothing when no size information is available.
 */
const SpaceRequirements = ({ usedSize }: { usedSize?: string }) => {
  if (!usedSize) return;

  // TRANSLATORS: %s is the required disk space
  const text = sprintf(_("About %s space required"), usedSize);

  return <Text textStyle="fontSizeMd">{text}</Text>;
};

type SoftwareSectionProps = {
  /** Section heading. */
  title: string;
  /** Optional explanatory text rendered below the heading. */
  description?: React.ReactNode;
  /** Label for the link that opens the pattern selection page. */
  buttonText: string;
  /** Total number of patterns in this group, selected or not. */
  totalCount: number;
  /** Patterns in this group that are currently selected. */
  patterns: Pattern[];
  /** Full selection map, used to determine how each pattern was selected. */
  selection: PatternsSelection;
  /** Content to show when no patterns are selected. */
  emptyContent: React.ReactNode;
};

/**
 * A page section displaying a group of software patterns with a count of how
 * many are selected, an optional description, and a link to change the
 * selection.
 *
 * Shows `emptyContent` when no patterns in the group are selected.
 */
const SoftwareSection = ({
  title,
  description,
  buttonText,
  totalCount,
  patterns,
  selection,
  emptyContent,
}: SoftwareSectionProps) => {
  const noneSelected = patterns.length === 0;
  // TRANSLATORS: %1$d is selected count, %2$d is total available count
  const selected =
    !noneSelected && sprintf(_("%1$d of %2$d selected"), patterns.length, totalCount);

  return (
    <Page.Section
      title={
        <>
          {title}{" "}
          {selected && <Text textStyle={["fontSizeXs", "textColorSubtle"]}>{selected}</Text>}
        </>
      }
      description={description}
      pfCardProps={{ isFullHeight: false }}
      actions={!noneSelected && <Link to={PATHS.patternsSelection}>{buttonText}</Link>}
    >
      <SelectedPatternsList patterns={patterns} selection={selection} emptyContent={emptyContent} />
    </Page.Section>
  );
};

/**
 * Fallback section shown when the product does not support pattern selection.
 */
const PatternSelectionUnavailable = () => (
  <Page.Section title={_("Patterns")}>
    <Content component="p">
      {/* TRANSLATORS: shown when the product does not support pattern selection at install time */}
      {_(
        "This product does not allow to select software patterns during installation. \
However, you can add additional software once the installation is finished.",
      )}
    </Content>
  </Page.Section>
);

/**
 * Main content of the software page.
 */
const SoftwarePageContent = () => {
  const { patterns } = useSystem();
  const proposal = useProposal();
  const issues = useIssues("software");

  if (!proposal) {
    // TRANSLATORS: shown while the software proposal is not yet available
    return <EmptyState headingLevel="h2" titleText={_("No information available yet")} />;
  }

  const usedSize = proposal.usedSpace
    ? xbytes(proposal.usedSpace * 1024, { iec: true })
    : undefined;

  const [allDesktops, allOtherPatterns] = fork(patterns, isDesktopPattern);
  const selectedPatterns = patterns.filter((p) => isPatternSelected(proposal.patterns, p.name));
  const [desktops, otherPatterns] = fork(selectedPatterns, isDesktopPattern);

  return (
    <Page.Content>
      <Content>
        <SpaceRequirements usedSize={usedSize} />
      </Content>
      <IssuesAlert issues={issues} />
      {isEmpty(proposal.patterns) ? (
        <PatternSelectionUnavailable />
      ) : (
        <Grid hasGutter>
          <GridItem lg={6}>
            <SoftwareSection
              title={_("Desktops")}
              description={_(
                // TRANSLATORS: description for the Desktops section
                "Graphical desktop environments for the system.",
              )}
              buttonText={
                // TRANSLATORS: button to change the desktop selection; singular when 1 is selected
                n_("Change desktop", "Change desktops", desktops.length)
              }
              totalCount={allDesktops.length}
              patterns={desktops}
              selection={proposal.patterns}
              emptyContent={
                <NothingSelected
                  // TRANSLATORS: hint shown when no desktop environment has been chosen
                  body={_("Select a desktop environment to get a graphical interface.")}
                  // TRANSLATORS: button to go to the desktop environment selection page
                  buttonText={_("Select a desktop")}
                />
              }
            />
          </GridItem>
          <GridItem lg={6}>
            <SoftwareSection
              title={_("Additional patterns")}
              description={_(
                // TRANSLATORS: description for the Additional software section
                "Curated sets of packages for common use cases and features to extend the system.",
              )}
              // TRANSLATORS: button to change the additional software selection
              buttonText={_("Change patterns")}
              totalCount={allOtherPatterns.length}
              patterns={otherPatterns}
              selection={proposal.patterns}
              emptyContent={
                <NothingSelected
                  // TRANSLATORS: hint shown when no additional software patterns have been chosen
                  body={_("Select one or more to extend the system.")}
                  // TRANSLATORS: button to go to the pattern selection page
                  buttonText={_("Select patterns")}
                />
              }
            />
          </GridItem>
        </Grid>
      )}
    </Page.Content>
  );
};

/**
 * Software page component
 */
function SoftwarePage() {
  return (
    <Page breadcrumbs={[{ label: _("Software") }]} progress={{ scope: "software" }}>
      <SoftwarePageContent />
    </Page>
  );
}

export default SoftwarePage;
