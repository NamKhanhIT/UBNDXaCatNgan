using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Quanlycongviec.Application.Common.Interfaces;
using Quanlycongviec.Domain.Entities;
using Quanlycongviec.Domain.Enums;

namespace Quanlycongviec.Application.Features.Tasks.Commands.SubmitUBMTTQReview
{
    public class SubmitUBMTTQReviewCommand : IRequest<SubmitUBMTTQReviewResult>
    {
        public Guid TaskId { get; set; }
        public Guid ReviewerUserId { get; set; }
        public string ReviewContent { get; set; } = string.Empty;
        public bool IsApproved { get; set; }
    }

    public class SubmitUBMTTQReviewResult
    {
        public bool Success { get; set; }
        public string? Message { get; set; }
    }

    public class SubmitUBMTTQReviewCommandHandler(IApplicationDbContext context)
        : IRequestHandler<SubmitUBMTTQReviewCommand, SubmitUBMTTQReviewResult>
    {
        public Task<SubmitUBMTTQReviewResult> Handle(SubmitUBMTTQReviewCommand request, CancellationToken cancellationToken) =>
            Task.FromResult(new SubmitUBMTTQReviewResult { Success = false,
                Message = "Nhánh phản biện UBMTTQ đã ngừng sử dụng. Vui lòng mở công việc và dùng luồng nghiệm thu thống nhất." });
    }
}