/* Read-only macOS process counters. No app state or OS settings are changed. */
#include <errno.h>
#include <inttypes.h>
#include <libproc.h>
#include <mach/mach_time.h>
#include <stdio.h>
#include <stdlib.h>
#include <sys/resource.h>
#include <time.h>

/* Optional diagnostic ABI from Apple's proc_info_private.h, not app code. */
struct widget_coalition_info { uint64_t ids[2]; uint64_t reserved[3]; };

int main(int argc, char **argv) {
    struct timespec at;
    mach_timebase_info_data_t timebase;
    mach_timebase_info(&timebase);
    clock_gettime(CLOCK_MONOTONIC, &at);
    printf("{\"monotonic_ns\":%" PRIu64 ",\"mach_timebase\":{\"numer\":%u,\"denom\":%u},\"processes\":[",
           (uint64_t)at.tv_sec * 1000000000ULL + (uint64_t)at.tv_nsec,
           timebase.numer, timebase.denom);
    for (int i = 1; i < argc; i++) {
        int pid = atoi(argv[i]);
        struct rusage_info_v4 usage = {0};
        struct widget_coalition_info coalition = {0};
        int ok = proc_pid_rusage(pid, RUSAGE_INFO_V4, (rusage_info_t *)&usage);
        if (i > 1) printf(",");
        if (ok != 0) {
            printf("{\"pid\":%d,\"error\":%d}", pid, errno);
            continue;
        }
        int coalition_bytes = proc_pidinfo(pid, 20, 0, &coalition, sizeof(coalition));
        printf("{\"pid\":%d,\"start_abstime\":%" PRIu64
               ",\"user_ns\":%" PRIu64 ",\"system_ns\":%" PRIu64
               ",\"footprint_bytes\":%" PRIu64 ",\"resident_bytes\":%" PRIu64
               ",\"lifetime_max_footprint_bytes\":%" PRIu64
               ",\"package_idle_wakeups\":%" PRIu64,
               pid, usage.ri_proc_start_abstime,
               (uint64_t)(((__uint128_t)usage.ri_user_time * timebase.numer) / timebase.denom),
               (uint64_t)(((__uint128_t)usage.ri_system_time * timebase.numer) / timebase.denom),
               usage.ri_phys_footprint, usage.ri_resident_size,
               usage.ri_lifetime_max_phys_footprint, usage.ri_pkg_idle_wkups);
        if (coalition_bytes == sizeof(coalition)) {
            printf(",\"coalition_resource_id\":%" PRIu64 ",\"coalition_jetsam_id\":%" PRIu64,
                   coalition.ids[0], coalition.ids[1]);
        } else printf(",\"coalition_unavailable\":true");
        printf("}");
    }
    puts("]}");
    return 0;
}
