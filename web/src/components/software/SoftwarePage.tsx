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
import xbytes from "xbytes";
import { fork, isEmpty } from "radashi";
import { sprintf } from "sprintf-js";
import {
  Alert,
  Button,
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
  Spinner,
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
import { N_, _, n_ } from "~/i18n";

import type { Pattern } from "~/model/system/software";
import type { PatternsSelection } from "~/model/proposal/software";
import { SelectedBy } from "~/model/proposal/software";

/**
 * Empty state for when no patterns are selected.
 */
const NoPatternsSelected = (): React.ReactNode => (
  // TRANSLATORS: empty state title for the additional software section
  <EmptyState headingLevel="h4" titleText={_("None selected")} variant="sm">
    <EmptyStateBody>
      {/* TRANSLATORS: hint shown when no additional software patterns have been chosen */}
      {_("Select one or more to extend the system.")}
    </EmptyStateBody>
    <EmptyStateFooter>
      <EmptyStateActions>
        <Link to={PATHS.patternsSelection} isPrimary>
          {/* TRANSLATORS: button to go to the pattern selection page */}
          {_("Select patterns")}
        </Link>
      </EmptyStateActions>
    </EmptyStateFooter>
  </EmptyState>
);

/**
 * Empty state for when no desktop is selected.
 */
const NoDesktopSelected = (): React.ReactNode => (
  // TRANSLATORS: empty state title for the desktops section
  <EmptyState headingLevel="h4" titleText={_("None selected")} variant="sm">
    <EmptyStateBody>
      {/* TRANSLATORS: hint shown when no desktop environment has been chosen */}
      {_("Select a desktop environment to get a graphical interface.")}
    </EmptyStateBody>
    <EmptyStateFooter>
      <EmptyStateActions>
        <Link to={PATHS.patternsSelection} isPrimary>
          {/* TRANSLATORS: button to go to the desktop environment selection page */}
          {_("Select a desktop")}
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
}): React.ReactNode => {
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

const Summary = ({ usedSize }: { usedSize?: string }): React.ReactNode => {
  if (!usedSize) return;

  // TRANSLATORS: %s is the required disk space
  const text = sprintf(_("About %s space required"), usedSize);

  return <Text textStyle="fontSizeMd">{text}</Text>;
};

const SoftwareSection = ({
  title,
  description,
  buttonText,
  totalCount,
  patterns,
  selection,
  emptyContent,
}: {
  title: string;
  description?: React.ReactNode;
  buttonText: string;
  totalCount: number;
  patterns: Pattern[];
  selection: PatternsSelection;
  emptyContent: React.ReactNode;
}): React.ReactNode => {
  const isEmpty = patterns.length === 0;
  // TRANSLATORS: %1$d is selected count, %2$d is total available count
  const selected = !isEmpty && sprintf(_("%1$d of %2$d selected"), patterns.length, totalCount);

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
      actions={!isEmpty && <Link to={PATHS.patternsSelection}>{buttonText}</Link>}
    >
      <SelectedPatternsList patterns={patterns} selection={selection} emptyContent={emptyContent} />
    </Page.Section>
  );
};

const NoPatterns = (): React.ReactNode => (
  <Page.Section title={_("Patterns")}>
    <p>
      {/* TRANSLATORS: shown when the product does not support pattern selection at install time */}
      {_(
        "This product does not allow to select software patterns during installation. \
However, you can add additional software once the installation is finished.",
      )}
    </p>
  </Page.Section>
);

const errorMsg = N_(
  /* TRANSLATORS: error details followed by a "Try again" link*/
  "Some installation repositories could not be loaded. \
The system cannot be installed without them.",
);

// error message, allow reloading the repositories again
const ReloadSection = ({
  loading,
  action,
}: {
  loading: boolean;
  action: () => void;
}): React.ReactNode => (
  // TRANSLATORS: title for an error message box, at least one repository could not be loaded
  <Alert variant="danger" isInline title={_("Repository load failed")}>
    {loading ? (
      <>
        {/* TRANSLATORS: progress message */}
        <Spinner size="md" /> {_("Loading the installation repositories...")}
      </>
    ) : (
      <>
        {_(errorMsg)}{" "}
        <Button variant="link" isInline onClick={action}>
          {/* TRANSLATORS: link for retrying failed repository load */}
          {_("Try again")}
        </Button>
      </>
    )}
  </Alert>
);

const PageContent = () => {
  const { patterns } = useSystem();
  const proposal = useProposal();
  const issues = useIssues("software");
  const [loading, setLoading] = useState(false);

  if (!proposal) {
    // TRANSLATORS: shown while the software proposal is not yet available
    return <EmptyState headingLevel="h2" titleText={_("No information available yet")} />;
  }

  // FIXME: temporarily disabled, the API end point is not implemented yet
  const repos = []; // useRepositories();
  const usedSize = proposal.usedSpace
    ? xbytes(proposal.usedSpace * 1024, { iec: true })
    : undefined;

  const [allDesktops, allOtherPatterns] = fork(patterns, isDesktopPattern);
  const selectedPatterns = patterns.filter((p) => isPatternSelected(proposal.patterns, p.name));
  const [desktops, otherPatterns] = fork(selectedPatterns, isDesktopPattern);

  const startProbing = () => {
    setLoading(true);
    // TODO: probe();
  };

  const showReposAlert = repos.some((r) => !r.loaded);

  return (
    <Page.Content>
      <Content>
        <Summary usedSize={usedSize} />
      </Content>
      <IssuesAlert issues={issues} />
      {showReposAlert && <ReloadSection loading={loading} action={startProbing} />}
      {isEmpty(proposal.patterns) ? (
        <NoPatterns />
      ) : (
        <>
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
                emptyContent={<NoDesktopSelected />}
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
                emptyContent={<NoPatternsSelected />}
              />
            </GridItem>
          </Grid>
        </>
      )}
    </Page.Content>
  );
};

/**
 * Software page component
 */
function SoftwarePage(): React.ReactNode {
  return (
    <Page breadcrumbs={[{ label: _("Software") }]} progress={{ scope: "software" }}>
      <PageContent />
    </Page>
  );
}

export default SoftwarePage;
