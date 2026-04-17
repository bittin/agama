#ifndef C_LOGGING_HXX_
#define C_LOGGING_HXX_

#include <string>

#include <systemd/sd-journal.h>

// helper macro for logging messages to systemd journal
#define LOG(level, message)                                                    \
  do {                                                                         \
    std::string line("CODE_LINE=");                                            \
    line.append(std::to_string(__LINE__));                                     \
    sd_journal_send_with_location(                                             \
        "CODE_FILE=" __FILE__, line.c_str(), __func__, "PRIORITY=%i", (level), \
        "MESSAGE=%s", (message), "COMPONENT=zypp-agama-sys", NULL);            \
  } while (0)

#endif
