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
  ExpandableSection,
  Flex,
  Grid,
  GridItem,
  Label,
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
import { useIssues } from "~/hooks/model/issue";
import { useProposal } from "~/hooks/model/proposal/software";
import { useSystem } from "~/hooks/model/system/software";
import { isPatternSelected } from "~/utils/software";
import { SOFTWARE as PATHS } from "~/routes/paths";
import { N_, _ } from "~/i18n";

import type { Pattern } from "~/model/system/software";
import type { PatternsSelection } from "~/model/proposal/software";
import { SelectedBy } from "~/model/proposal/software";

/**
 * List of selected patterns.
 */
const SelectedPatternsList = ({
  patterns,
  selection,
}: {
  patterns: Pattern[];
  selection: PatternsSelection;
}): React.ReactNode => {
  if (patterns.length === 0) {
    return <>{_("No additional software was selected.")}</>;
  }

  return (
    <NestedContent margin="mxSm">
      <List isPlain>
        {patterns.map((pattern) => (
          <ListItem key={pattern.name}>
            <Text>
              <Text isBold>{pattern.summary} </Text>
              {selection[pattern.name] === SelectedBy.AUTO && (
                <Label color="blue" isCompact>
                  {/* TRANSLATORS: label shown for patterns automatically selected as dependencies */}
                  {_("auto selected")}
                </Label>
              )}
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
  );
};

const SummaryNoSize = ({
  desktopCount,
  patternCount,
}: {
  desktopCount: number;
  patternCount: number;
}): React.ReactNode => {
  let text = "";

  if (patternCount > 0 && desktopCount > 0) {
    text = sprintf(
      // TRANSLATORS: %1$d is pattern count, %2$d is desktop count
      _("%1$d patterns and %2$d desktop selected"),
      patternCount,
      desktopCount,
    );
  } else if (patternCount > 0) {
    text = sprintf(_("%d patterns selected"), patternCount);
  } else if (desktopCount > 0) {
    text = sprintf(_("%d desktop selected"), desktopCount);
  }

  return (
    <Flex direction={{ default: "column" }}>
      <Content isEditorial>
        <Text>{text}</Text>
      </Content>
    </Flex>
  );
};

const Summary = ({
  desktopCount,
  patternCount,
  usedSize,
}: {
  desktopCount: number;
  patternCount: number;
  usedSize?: string;
}): React.ReactNode => {
  if (!usedSize) {
    return <SummaryNoSize desktopCount={desktopCount} patternCount={patternCount} />;
  }

  let summaryText = "";

  if (patternCount > 0 && desktopCount > 0) {
    summaryText = sprintf(
      // TRANSLATORS: %1$s is size, %2$d is pattern count, %3$d is desktop count
      _("About %1$s space needed with the current selection (%2$d patterns and %3$d desktops)"),
      usedSize,
      patternCount,
      desktopCount,
    );
  } else if (patternCount > 0) {
    summaryText = sprintf(
      // TRANSLATORS: %1$s is size, %2$d is pattern count
      _("About %1$s space needed with the current selection (%2$d patterns)"),
      usedSize,
      patternCount,
    );
  } else if (desktopCount > 0) {
    summaryText = sprintf(
      // TRANSLATORS: %1$s is size, %2$d is desktop count
      _("About %1$s space needed with the current selection (%2$d desktops)"),
      usedSize,
      desktopCount,
    );
  } else {
    summaryText = sprintf(
      // TRANSLATORS: %s is the required space
      _("About %s space needed"),
      usedSize,
    );
  }

  return (
    <Flex direction={{ default: "column" }}>
      <Content isEditorial>
        <Text>{summaryText}</Text>
      </Content>
    </Flex>
  );
};

const SoftwareSection = ({
  title,
  buttonText,
  patterns,
  selection,
}: {
  title: string;
  buttonText: string;
  patterns: Pattern[];
  selection: PatternsSelection;
}): React.ReactNode => (
  <Page.Section
    title={title}
    pfCardProps={{ isFullHeight: false }}
    actions={
      <Link to={PATHS.patternsSelection} isPrimary>
        {buttonText}
      </Link>
    }
  >
    <SelectedPatternsList patterns={patterns} selection={selection} />
  </Page.Section>
);

const NoPatterns = (): React.ReactNode => (
  <Page.Section title={_("Patterns")}>
    <p>
      {_(
        "This product does not allow to select software patterns during installation. However, you can add additional software once the installation is finished.",
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
    return <EmptyState headingLevel="h2" titleText={_("No information available yet")} />;
  }

  // FIXME: temporarily disabled, the API end point is not implemented yet
  const repos = []; // useRepositories();
  const usedSize = proposal.usedSpace
    ? xbytes(proposal.usedSpace * 1024, { iec: true })
    : undefined;

  const selectedPatterns = patterns.filter((p) => isPatternSelected(proposal.patterns, p.name));
  const [desktops, otherPatterns] = fork(
    selectedPatterns,
    (p) => p.category === "Graphical Environments",
  );

  const startProbing = () => {
    setLoading(true);
    // TODO: probe();
  };

  const showReposAlert = repos.some((r) => !r.loaded);

  return (
    <>
      <Page.Content>
        <IssuesAlert issues={issues} />
        {showReposAlert && <ReloadSection loading={loading} action={startProbing} />}
        {isEmpty(proposal.patterns) ? (
          <NoPatterns />
        ) : (
          <>
            <Summary
              desktopCount={desktops.length}
              patternCount={otherPatterns.length}
              usedSize={usedSize}
            />
            <Grid hasGutter>
              <GridItem lg={6}>
                <SoftwareSection
                  title={_("Patterns")}
                  buttonText={_("Change patterns")}
                  patterns={otherPatterns}
                  selection={proposal.patterns}
                />
              </GridItem>
              <GridItem lg={6}>
                <SoftwareSection
                  title={_("Desktop")}
                  buttonText={_("Change desktop")}
                  patterns={desktops}
                  selection={proposal.patterns}
                />
              </GridItem>
            </Grid>
          </>
        )}
      </Page.Content>
    </>
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
