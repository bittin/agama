#! /bin/sh

# Script to clean kernel command line from agama specific parameters. Result is later used for bootloader proposal.

SOURCE="${1:-/proc/cmdline}"
TARGET="${2:-/run/agama/cmdline.d/kernel.conf}"

write_kernel_args() {
  DIR=$(dirname "${TARGET}")
  mkdir -p "$DIR"
  # ensure that kernel cmdline line is created to avoid reading agama params
  # if there is no kernel params
  touch "${TARGET}"

  for _i in $(cat "${SOURCE}"); do
    case ${_i} in
    # remove all agama kernel params
    # Add here also all linuxrc supported parameters
    LIBSTORAGE_* | YAST_* | inst* | agama* | live* | Y2* | ZYPP_* | autoyast*)
      _found=1
      ;;
    esac

    if [ -z "$_found" ]; then
      echo "Non-Agama parameter found ($_i)"
      echo -n " $_i" >>"${TARGET}"
    fi
    unset _found
  done

  return 0
}

write_kernel_args
